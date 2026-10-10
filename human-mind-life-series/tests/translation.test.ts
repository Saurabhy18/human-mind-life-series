import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { writeSourceBook } from "./support/helpers";
import { createOrder, drainWorker, pdfText } from "./support/orders";

beforeAll(async () => {
  await writeSourceBook("volume-4");
});

async function translatedBytes(orderId: number) {
  const { getDb } = await import("@/lib/server/db");
  const { getStorage } = await import("@/lib/server/storageService");
  const tb = getDb().prepare("SELECT tb.storage_key FROM order_items i JOIN translated_books tb ON tb.id = i.translated_book_id WHERE i.order_id = ?").get(orderId) as { storage_key: string };
  return getStorage().get(tb.storage_key);
}

async function fake() {
  const { getTranslationService, FakeTranslationService } = await import("@/lib/server/translation/googleTranslationService");
  const svc = getTranslationService();
  expect(svc).toBeInstanceOf(FakeTranslationService);
  return svc as InstanceType<typeof FakeTranslationService>;
}

describe("Chunking", () => {
  it("keeps every request within the character limit and splits long text at sentences", async () => {
    const { splitLongText, batchByChars } = await import("@/lib/server/translation/chunker");
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const parts = splitLongText(long, 200);
    expect(parts.every((p) => [...p].length <= 200)).toBe(true);
    expect(parts.join(" ")).toBe(long);
    const batches = batchByChars(parts, 450);
    for (const b of batches) expect(b.reduce((n, i) => n + parts[i].length, 0)).toBeLessThanOrEqual(450);
  });
});

describe("Translation pipeline (text strategy, fake translator)", () => {
  for (const [lang, marker] of [
    ["fr", "[fr]"],
    ["es", "[es]"],
    ["ja", "翻訳"],
    ["zh-CN", "翻译"],
    ["hi", "अनुवाद"],
    // PDF text extraction returns Tamil prefix vowel signs in visual order (ெமா for மொ), so match the script, not the exact string.
    ["ta", /\[ta[\u0B80-\u0BFF]+\]/],
  ] as const) {
    it(`English → ${lang}: paid order is translated, stored privately and marked ready`, async () => {
      const o = await createOrder("volume-4", lang);
      expect(o.get()).toMatchObject({ payment_status: "PAID", fulfillment_status: "PROCESSING" });
      await drainWorker();
      const order = o.get();
      expect(order.fulfillment_status).toBe("COMPLETED");
      expect(o.item().access_expires_at).toBeTruthy();

      const bytes = await translatedBytes(order.id);
      const { pages } = await pdfText(bytes);
      expect(pages[0].trim()).toBe(""); // original image-only cover copied unchanged
      const all = pages.join(" ");
      // Translated text (whitespace ignored: PDF text extraction splits shaped Indic clusters with spaces).
      if (typeof marker === "string") expect(all.replace(/\s+/g, "")).toContain(marker.replace(/\s+/g, ""));
      else expect(all.replace(/\s+/g, "")).toMatch(marker);
      expect(all).toContain("Chapter 1"); // structure preserved (heading text carried through)
      expect(all).not.toContain("Test Author | Test Book"); // running header removed and regenerated
    });
  }

  it("preserves structure: headings, list items and joined paragraphs", async () => {
    const { PdfParser } = await import("@/lib/server/translation/parsers/pdfParser");
    const { STORAGE } = await import("./support/helpers");
    const content = await new PdfParser().extractContent(`${STORAGE()}/books/volume-4.pdf`);
    expect(content.title).toBe("TEST BOOK");
    expect(content.blocks[0]).toEqual({ type: "originalPage", pageIndex: 0 });
    const types = content.blocks.map((b) => b.type);
    expect(types).toContain("heading");
    const ul = content.blocks.find((b) => b.type === "list" && !b.ordered) as { items: string[] };
    expect(ul.items).toEqual(["Understand how intimacy can evolve after fifty.", "Use clearer communication about comfort, consent, preferences, and boundaries."]);
    const ol = content.blocks.find((b) => b.type === "list" && b.ordered) as { items: string[] };
    expect(ol.items[0]).toBe("What idea in this chapter challenged an assumption?");
    const para = content.blocks.find((b) => b.type === "paragraph" && b.text.startsWith("Intimacy")) as { text: string };
    expect(para.text).toBe("Intimacy does not have an expiration date. This line wraps onto a second line, so the parser must join the lines into one paragraph."); // wrapped lines joined
  });

  it("English orders deliver the original without any translation", async () => {
    const svc = await fake();
    const before = svc.calls.text;
    const o = await createOrder("volume-4", "en");
    expect(o.get().fulfillment_status).toBe("COMPLETED");
    expect(svc.calls.text).toBe(before);
  });
});

describe("Caching, deduplication and versioning", () => {
  it("the same book + language is translated once and reused", async () => {
    const svc = await fake();
    const first = await createOrder("volume-4", "de");
    await drainWorker();
    const callsAfterFirst = svc.calls.text;
    const charsAfterFirst = svc.calls.chars;

    const second = await createOrder("volume-4", "de");
    // Completed instantly from cache — no new job, no new API calls.
    expect(second.get().fulfillment_status).toBe("COMPLETED");
    expect(svc.calls.text).toBe(callsAfterFirst);
    expect(svc.calls.chars).toBe(charsAfterFirst);
    expect(second.item().translated_book_id).toBe(first.item().translated_book_id);
  });

  it("many orders queued at once share one job", async () => {
    const { getDb } = await import("@/lib/server/db");
    const orders = await Promise.all([1, 2, 3, 4, 5].map(() => createOrder("volume-4", "ta")));
    const key = orders[0].item().cache_key;
    expect(new Set(orders.map((o) => o.item().cache_key)).size).toBe(1);
    expect((getDb().prepare("SELECT COUNT(*) n FROM translation_jobs WHERE cache_key = ?").get(key) as { n: number }).n).toBe(1);
    await drainWorker();
    for (const o of orders) expect(o.get().fulfillment_status).toBe("COMPLETED");
  });

  it("a changed source book gets a new version and a fresh translation", async () => {
    const before = await createOrder("volume-4", "fr");
    await drainWorker();
    const oldKey = before.item().cache_key!;
    await writeSourceBook("volume-4", { marker: "Revised" });
    const after = await createOrder("volume-4", "fr");
    expect(after.item().cache_key).not.toBe(oldKey);
    expect(after.item().cache_key).toMatch(/^volume-4:en:fr:v-[0-9a-f]{12}$/);
    await drainWorker();
    const { pages } = await pdfText(await translatedBytes(after.id));
    expect(pages.join(" ")).toContain("Revised");
  });
});

describe("Retries and failures", () => {
  it("retries with backoff, then FAILS; an admin retry completes it", async () => {
    const svc = await fake();
    const { getDb } = await import("@/lib/server/db");
    svc.failNext = 999; // Google is "down"
    const o = await createOrder("volume-4", "ar");
    await drainWorker();
    const job = getDb().prepare("SELECT * FROM translation_jobs WHERE cache_key = ?").get(o.item().cache_key) as { id: number; status: string; attempts: number; last_error: string };
    expect(job.status).toBe("FAILED");
    expect(job.attempts).toBe(3);
    expect(job.last_error).toContain("Simulated Google outage");
    expect(o.get().fulfillment_status).toBe("FAILED");

    // Customer sees a friendly message, never the internal error.
    const { customerStatus } = await import("@/lib/server/fulfillment");
    expect(await customerStatus(o.get())).toMatchObject({ stage: "FAILED" });
    expect(JSON.stringify(await customerStatus(o.get()))).not.toContain("Simulated");

    svc.failNext = 0;
    const { retryTranslation } = await import("@/lib/server/fulfillment");
    expect(retryTranslation(job.id)).toBe(true);
    await drainWorker();
    expect(o.get().fulfillment_status).toBe("COMPLETED");
  });

  it("a temporary failure is retried automatically", async () => {
    const svc = await fake();
    svc.failNext = 1;
    const o = await createOrder("volume-4", "zh-TW");
    await drainWorker();
    expect(o.get().fulfillment_status).toBe("COMPLETED");
  });

  it("a scanned (image-only) source PDF fails at once with a clear admin message, and is redelivered after OCR", async () => {
    const { PDFDocument, rgb } = await import("pdf-lib");
    const { STORAGE } = await import("./support/helpers");
    const scanned = await PDFDocument.create();
    for (let i = 0; i < 3; i++) scanned.addPage([432, 649]).drawRectangle({ x: 40, y: 40, width: 300, height: 500, color: rgb(0.8, 0.8, 0.8) });
    fs.writeFileSync(`${STORAGE()}/books/why-people-do-what-they-do.pdf`, await scanned.save());
    const svc = await fake();
    const before = { ...svc.calls };
    const o = await createOrder("why-people-do-what-they-do", "fr");
    await drainWorker();
    const { getDb } = await import("@/lib/server/db");
    const job = getDb().prepare("SELECT status, attempts, last_error FROM translation_jobs WHERE cache_key = ?").get(o.item().cache_key) as { status: string; attempts: number; last_error: string };
    expect(job).toMatchObject({ status: "FAILED", attempts: 1 }); // not retried: retrying cannot help
    expect(job.last_error).toContain("no selectable text");
    expect(svc.calls).toEqual(before); // nothing was sent to the translator
    expect(o.item().fulfillment_status).toBe("FAILED");

    // The admin uploads an OCR'd (text) PDF and clicks "Retry automatic delivery": the new file is used.
    await writeSourceBook("why-people-do-what-they-do");
    const { startFulfillment } = await import("@/lib/server/fulfillment");
    await startFulfillment(o.id, { retryFailed: true });
    await drainWorker();
    expect(o.item().fulfillment_status).toBe("COMPLETED");
    expect(o.get().fulfillment_status).toBe("COMPLETED");
  });

  it("books without a source PDF stay with manual delivery (no job)", async () => {
    const o = await createOrder("the-psychology-of-human-behavior", "en");
    expect(o.get()).toMatchObject({ payment_status: "PAID", fulfillment_status: "NOT_STARTED" });
    expect(o.item().cache_key).toBeNull();
    const { customerStatus } = await import("@/lib/server/fulfillment");
    expect((await customerStatus(o.get())).stage).toBe("MANUAL_DELIVERY");
  });
});

describe("Document strategy (layout-preserving Google Document Translation)", () => {
  it("splits long books into parts, translates each and merges them in order", async () => {
    const svc = await fake();
    const { STORAGE } = await import("./support/helpers");
    await writeSourceBook("doc-test", { pages: 5 });
    const { translateBook } = await import("@/lib/server/translation/bookTranslationService");
    const before = svc.calls.document;
    const progress: number[] = [];
    const res = await translateBook(
      svc,
      { jobId: 0, bookSlug: "volume-4", sourceFile: `${STORAGE()}/books/doc-test.pdf`, sourceLanguage: "en", targetLanguage: "fr", sourceVersion: "v-test", strategy: "document" },
      (_p, pct) => {
        progress.push(pct);
      },
    );
    expect(svc.calls.document - before).toBe(3); // 6 pages → 3 requests of 2 pages (DOC_TRANSLATION_PAGES_PER_REQUEST=2)
    expect(res.pagesTranslated).toBe(6);
    expect(res.estCostUsd).toBeCloseTo(6 * 0.08, 5);
    const { getStorage } = await import("@/lib/server/storageService");
    const { pages } = await pdfText(await getStorage().get(res.storageKey));
    expect(pages).toHaveLength(6);
    expect(pages.every((t) => t.includes("[translated: fr]"))).toBe(true);
    expect(progress[progress.length - 1]).toBeGreaterThanOrEqual(90);
    expect(fs.existsSync(`${STORAGE()}/files/${res.storageKey}`)).toBe(true);
  });
});
