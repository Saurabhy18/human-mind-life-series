import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getReq, jsonReq, mockCashfree, ORIGIN, pngBytes, signWebhook, webhookBody, WEBHOOK_TS, writeSourceBook } from "./support/helpers";
import { drainWorker } from "./support/orders";

// Volumes 1, 2 and 4 have an English source PDF; 3 and 5 do not, so they can't be ordered until their PDFs are added (see the end of "Bundle delivery").
const V1 = "the-psychology-of-human-behavior";
const V2 = "why-people-do-what-they-do";
const V3 = "ancient-wisdom-for-the-modern-mind";
const V4 = "volume-4";
const V5 = "a-healthy-sex-life-at-any-age";

let cf: ReturnType<typeof mockCashfree>;
beforeAll(async () => {
  await writeSourceBook(V1);
  await writeSourceBook(V2);
  await writeSourceBook(V4);
  cf = mockCashfree();
});
afterAll(() => cf.restore());

const pick = (...pairs: [string, string][]) => pairs.map(([bookId, language]) => ({ bookId, language }));
const customer = () => ({ customerName: "Meera Iyer", customerEmail: `meera+${Math.random().toString(36).slice(2)}@example.com`, consent: true });

async function placeOrder(packageId: unknown, items: unknown, extra: Record<string, unknown> = {}) {
  const { POST } = await import("@/app/api/orders/route");
  const res = await POST(jsonReq("/api/orders", { packageId, items, ...customer(), ...extra }));
  return { status: res.status, body: await res.json() };
}

async function db() {
  return (await import("@/lib/server/db")).getDb();
}

/** Places an order, then confirms its payment on the server (as the admin's "Payment Verified" does). */
async function paidOrder(packageId: string, items: { bookId: string; language: string }[]) {
  const r = await placeOrder(packageId, items);
  expect(r.status).toBe(200);
  const { getOrderByRef, getOrderItems } = await import("@/lib/server/orders");
  const { markOrderPaid } = await import("@/lib/server/fulfillment");
  const o = getOrderByRef(r.body.orderId)!;
  await markOrderPaid({ orderId: o.id, provider: "manual_upi", idempotencyKey: `test:${o.id}`, amount: o.amount, currency: o.currency });
  const items_ = () => getOrderItems(o.id);
  return { ref: o.ref, id: o.id, token: r.body.accessToken as string, items: items_, item: (slug: string) => items_().find((i) => i.book_slug === slug)!, order: () => getOrderByRef(o.ref)! };
}

async function download(ref: string, token: string, item?: number) {
  const { GET } = await import("@/app/api/orders/[orderId]/download/route");
  const res = await GET(getReq(`/api/orders/${ref}/download${item === undefined ? "" : `?item=${item}`}`, { "x-order-token": token }), { params: Promise.resolve({ orderId: ref }) });
  return { status: res.status, body: await res.json() };
}

async function status(ref: string, token: string) {
  const { GET } = await import("@/app/api/orders/[orderId]/status/route");
  return (await GET(getReq(`/api/orders/${ref}/status`, { "x-order-token": token }), { params: Promise.resolve({ orderId: ref }) })).json();
}

async function fake() {
  const { getTranslationService } = await import("@/lib/server/translation/googleTranslationService");
  return getTranslationService() as import("@/lib/server/translation/googleTranslationService").FakeTranslationService;
}

describe("Package prices come from the server", () => {
  it("Individual Ebook: 1 ebook → ₹299", async () => {
    const r = await placeOrder("individual", pick([V1, "hi"]));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ packageId: "individual", amount: 299, currency: "INR" });
  });

  it("3 Book Bundle: 3 ebooks → ₹649 (not 3 × ₹299), each with its own language, in series order", async () => {
    const r = await placeOrder("three_book_bundle", pick([V4, "en"], [V1, "hi"], [V2, "en"]));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ packageId: "three_book_bundle", amount: 649 });
    const { getOrderByRef, getOrderItems } = await import("@/lib/server/orders");
    const o = getOrderByRef(r.body.orderId)!;
    expect(o).toMatchObject({ package_type: "three_book_bundle", amount: 649, currency: "INR", payment_status: "PENDING" });
    expect(getOrderItems(o.id).map((i) => [i.book_slug, i.target_language])).toEqual([
      [V1, "hi"],
      [V2, "en"],
      [V4, "en"],
    ]);
  });

  it("5 Book Bundle: no order (so no charge) while any of its PDFs is missing", async () => {
    const r = await placeOrder("five_book_bundle", pick([V1, "hi"], [V2, "en"], [V3, "en"], [V4, "ja"], [V5, "en"]));
    expect(r.status).toBe(422);
    expect(r.body.message).toBe("“Ancient Wisdom for the Modern Mind” is not available for online purchase yet, so this bundle can’t be bought right now.");
  });

  it("prices or totals sent by the browser are ignored", async () => {
    const r = await placeOrder("three_book_bundle", pick([V1, "en"], [V2, "en"], [V4, "en"]), { amount: 1, price: 1, total: 1, currency: "USD", paymentStatus: "PAID" });
    expect(r.body).toMatchObject({ amount: 649, currency: "INR", paymentRequired: true });
  });
});

describe("Invalid selections are rejected on the server", () => {
  const cases: [string, unknown, unknown, string][] = [
    ["2 books for the 3-book bundle", "three_book_bundle", pick([V1, "en"], [V2, "en"]), "Please select exactly 3 ebooks for this bundle."],
    ["4 books for the 3-book bundle", "three_book_bundle", pick([V1, "en"], [V2, "en"], [V3, "en"], [V4, "en"]), "Please select exactly 3 ebooks for this bundle."],
    ["4 books for the 5-book bundle", "five_book_bundle", pick([V1, "en"], [V2, "en"], [V3, "en"], [V4, "en"]), "Please select exactly 5 ebooks for this bundle."],
    ["2 books for an individual ebook", "individual", pick([V1, "en"], [V2, "en"]), "Please select 1 ebook."],
    ["no books", "individual", [], "Please select 1 ebook."],
    ["items that are not a list", "individual", "volume-4", "Please select 1 ebook."],
    ["the same book twice", "three_book_bundle", pick([V1, "en"], [V1, "hi"], [V2, "en"]), "Each ebook can only be selected once."],
    ["a free book", "individual", pick(["volume-6", "en"]), "One of the selected ebooks is not available. Please choose again."],
    ["an unknown book", "individual", pick(["nope", "en"]), "One of the selected ebooks is not available. Please choose again."],
    ["an unknown package", "ten_book_bundle", pick([V1, "en"]), "Please choose a valid package."],
    ["a missing package", undefined, pick([V1, "en"]), "Please choose a valid package."],
    ["a missing language", "individual", [{ bookId: V1 }], "Please select a language for each ebook."],
    ["an empty language", "three_book_bundle", pick([V1, "en"], [V2, ""], [V4, "en"]), "Please select a language for each ebook."],
    ["an unsupported language", "individual", pick([V1, "xx"]), "Please choose a language from the list."],
    ["a book whose PDF is not on the server", "individual", pick([V3, "en"]), "“Ancient Wisdom for the Modern Mind” is not available for online purchase yet."],
  ];
  for (const [name, packageId, items, message] of cases) {
    it(`rejects ${name}`, async () => {
      const before = ((await db()).prepare("SELECT COUNT(*) n FROM orders").get() as { n: number }).n;
      const r = await placeOrder(packageId, items);
      expect(r.status).toBe(422);
      expect(r.body.message).toContain(message);
      expect(((await db()).prepare("SELECT COUNT(*) n FROM orders").get() as { n: number }).n).toBe(before);
    });
  }
});

describe("UPI QR payment form", () => {
  it("stores the package, each ebook's language and the SERVER's amount (the amount typed by the customer is kept for checking)", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const form = new FormData();
    form.set("buyerName", "Ravi Kumar");
    form.set("email", "ravi.bundle@example.com");
    form.set("whatsapp", "9876543210");
    form.set("packageId", "three_book_bundle");
    form.set("items", JSON.stringify(pick([V1, "hi"], [V2, "ja"], [V4, "fr"])));
    form.set("amountPaid", "1");
    form.set("utr", "UTRBUNDLE0001");
    form.set("consent", "on");
    form.set("screenshot", new Blob([new Uint8Array(pngBytes())], { type: "image/png" }), "shot.png");
    const res = await POST(new Request(`${ORIGIN}/api/orders`, { method: "POST", body: form, headers: { origin: ORIGIN, host: "shop.example.com" } }));
    const body = await res.json();
    expect(res.status).toBe(200);
    const { amountMismatch, getOrderByRef, getOrderItems } = await import("@/lib/server/orders");
    const o = getOrderByRef(body.ref)!;
    expect(o).toMatchObject({ package_type: "three_book_bundle", amount: 649, amount_paid: 1, payment_status: "PENDING", payment_provider: "manual_upi" });
    expect(amountMismatch(o)).toBe(true); // highlighted for the admin
    expect(getOrderItems(o.id).map((i) => i.target_language)).toEqual(["hi", "ja", "fr"]);
  });

  it("rejects a bundle with the wrong number of books before saving the screenshot", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const form = new FormData();
    form.set("buyerName", "Ravi Kumar");
    form.set("email", "ravi.bad@example.com");
    form.set("whatsapp", "9876543210");
    form.set("packageId", "three_book_bundle");
    form.set("items", JSON.stringify(pick([V1, "hi"], [V2, "ja"])));
    form.set("amountPaid", "649");
    form.set("utr", "UTRBUNDLE0002");
    form.set("consent", "on");
    form.set("screenshot", new Blob([new Uint8Array(pngBytes())], { type: "image/png" }), "shot.png");
    const res = await POST(new Request(`${ORIGIN}/api/orders`, { method: "POST", body: form, headers: { origin: ORIGIN, host: "shop.example.com" } }));
    expect(res.status).toBe(422);
    expect((await res.json()).message).toBe("Please select exactly 3 ebooks for this bundle.");
  });
});

describe("Bundle delivery: one order, different languages per ebook", () => {
  let bundle: Awaited<ReturnType<typeof paidOrder>>;

  it("after payment: English is ready at once, translations are queued (one job each), then all become ready", async () => {
    bundle = await paidOrder("three_book_bundle", pick([V1, "hi"], [V2, "en"], [V4, "ja"]));
    expect(bundle.item(V2).fulfillment_status).toBe("COMPLETED");
    expect(bundle.item(V1).fulfillment_status).toBe("PROCESSING");
    expect(bundle.item(V4).fulfillment_status).toBe("PROCESSING");
    expect(bundle.order().fulfillment_status).toBe("PROCESSING");
    const jobs = (await db()).prepare("SELECT book_slug, target_language FROM translation_jobs WHERE cache_key IN (?, ?)").all(bundle.item(V1).cache_key, bundle.item(V4).cache_key);
    expect(jobs).toHaveLength(2);

    const { sentEmailsForTests } = await import("@/lib/server/emailService");
    const preparing = sentEmailsForTests.filter((e) => e.text.includes(bundle.ref) && e.subject.includes("being prepared"));
    expect(preparing).toHaveLength(1);
    expect(preparing[0].text).toMatch(/Hindi: Being prepared/);
    expect(preparing[0].text).toMatch(/English: Ready to download/);

    const s1 = await status(bundle.ref, bundle.token);
    expect(s1).toMatchObject({ success: true, packageName: "3 Book Bundle", amount: 649, paymentStatus: "PAID" });
    expect(s1.items.map((i: { stage: string }) => i.stage)).toEqual(["PREPARING", "READY", "PREPARING"]);

    await drainWorker();
    expect(bundle.items().every((i) => i.fulfillment_status === "COMPLETED")).toBe(true);
    expect(bundle.order().fulfillment_status).toBe("COMPLETED");
    const ready = sentEmailsForTests.filter((e) => e.text.includes(bundle.ref) && e.subject === "Your ebooks are ready");
    expect(ready).toHaveLength(1); // one email for the whole order
    for (const lang of ["Hindi", "English", "Japanese"]) expect(ready[0].text).toContain(lang);

    const s2 = await status(bundle.ref, bundle.token);
    expect(s2.stage).toBe("READY");
    expect(s2.items.map((i: { languageName: string }) => i.languageName)).toEqual(["Hindi", "English", "Japanese"]);
    expect(JSON.stringify(s2)).not.toMatch(/@example\.com|storage|cache|v-[0-9a-f]{12}/);
  });

  it("each ebook downloads its OWN book in its OWN language", async () => {
    const hi = await download(bundle.ref, bundle.token, bundle.item(V1).id);
    expect(hi.status).toBe(200);
    expect(hi.body.downloadUrl).toMatch(new RegExp(`^/api/files/translations/${V1}/hi/v-[0-9a-f]{12}\\.pdf\\?.*name=The-Psychology-of-Human-Behavior-Hindi\\.pdf`));
    const en = await download(bundle.ref, bundle.token, bundle.item(V2).id);
    expect(en.body.downloadUrl).toMatch(new RegExp(`^/api/files/originals/${V2}/`));
    const ja = await download(bundle.ref, bundle.token, bundle.item(V4).id);
    expect(ja.body.downloadUrl).toMatch(new RegExp(`^/api/files/translations/${V4}/ja/`));
    expect(bundle.item(V1).download_count).toBe(1);
  });

  it("a later order for the same book + language reuses the stored PDF (no new Google call)", async () => {
    const svc = await fake();
    const calls = { ...svc.calls };
    const again = await paidOrder("individual", pick([V1, "hi"]));
    expect(again.item(V1).fulfillment_status).toBe("COMPLETED");
    expect(again.item(V1).translated_book_id).toBe(bundle.item(V1).translated_book_id);
    expect(svc.calls).toEqual(calls);
    expect(((await db()).prepare("SELECT COUNT(*) n FROM translation_jobs WHERE cache_key = ?").get(bundle.item(V1).cache_key) as { n: number }).n).toBe(1);
  });

  it("two bundles paid at the same time that need the same translation share ONE job", async () => {
    const [a, b] = await Promise.all([paidOrder("three_book_bundle", pick([V1, "en"], [V2, "en"], [V4, "fr"])), paidOrder("individual", pick([V4, "fr"]))]);
    expect(a.item(V4).cache_key).toBe(b.item(V4).cache_key);
    expect(((await db()).prepare("SELECT COUNT(*) n FROM translation_jobs WHERE cache_key = ?").get(a.item(V4).cache_key) as { n: number }).n).toBe(1);
    await drainWorker();
    expect(a.item(V4).fulfillment_status).toBe("COMPLETED");
    expect(b.item(V4).translated_book_id).toBe(a.item(V4).translated_book_id);
  });

  it("once every PDF is present, the 5 Book Bundle costs ₹999 and all five ebooks are delivered", async () => {
    await writeSourceBook(V3);
    await writeSourceBook(V5);
    const all = await paidOrder("five_book_bundle", pick([V1, "en"], [V2, "en"], [V3, "en"], [V4, "en"], [V5, "en"]));
    expect(all.order()).toMatchObject({ package_type: "five_book_bundle", amount: 999 });
    expect(all.items().map((i) => i.fulfillment_status)).toEqual(["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED"]);
    const s = await status(all.ref, all.token);
    expect(s.items.map((i: { stage: string }) => i.stage)).toEqual(["READY", "READY", "READY", "READY", "READY"]);
    expect((await download(all.ref, all.token, all.item(V3).id)).status).toBe(200);
  });
});

describe("Download authorization per ebook", () => {
  it("an unpaid bundle cannot be downloaded", async () => {
    const r = await placeOrder("three_book_bundle", pick([V1, "en"], [V2, "en"], [V4, "en"]));
    const { getOrderByRef, getOrderItems } = await import("@/lib/server/orders");
    const item = getOrderItems(getOrderByRef(r.body.orderId)!.id)[0];
    const d = await download(r.body.orderId, r.body.accessToken, item.id);
    expect(d.status).toBe(402);
    expect(d.body).toMatchObject({ code: "NOT_PAID", message: "Your payment is being verified. Please wait." });
  });

  it("an ebook still being translated is NOT READY while the rest of the order downloads", async () => {
    const o = await paidOrder("three_book_bundle", pick([V1, "es"], [V2, "en"], [V4, "en"]));
    const d = await download(o.ref, o.token, o.item(V1).id);
    expect(d.status).toBe(409);
    expect(d.body).toMatchObject({ code: "NOT_READY", message: "Your selected-language ebook is being prepared." });
    expect((await download(o.ref, o.token, o.item(V2).id)).status).toBe(200);
    await drainWorker();
  });

  it("a multi-ebook order must say which ebook; a single-ebook order needn't", async () => {
    const multi = await paidOrder("three_book_bundle", pick([V1, "en"], [V2, "en"], [V4, "en"]));
    expect((await download(multi.ref, multi.token)).status).toBe(400);
    const single = await paidOrder("individual", pick([V2, "en"]));
    expect((await download(single.ref, single.token)).status).toBe(200);
  });

  it("a customer cannot download another customer's ebook, or a language they did not buy", async () => {
    const mine = await paidOrder("individual", pick([V4, "en"]));
    const theirs = await paidOrder("individual", pick([V4, "fr"])); // same book, a language I did NOT buy
    await drainWorker();
    // Their ebook's id with MY token → not found (items are only looked up inside the token's own order).
    expect((await download(mine.ref, mine.token, theirs.item(V4).id)).status).toBe(404);
    // Their order reference with my token → not found.
    expect((await download(theirs.ref, mine.token, theirs.item(V4).id)).status).toBe(404);
    expect((await download(mine.ref, mine.token, 99999999)).status).toBe(404);
    expect((await download(mine.ref, mine.token, "abc" as unknown as number)).status).toBe(404);
    // My own ebook works.
    expect((await download(mine.ref, mine.token, mine.item(V4).id)).status).toBe(200);
  });

  it("a failed translation shows a friendly message; the internal error is never shown to the customer", async () => {
    const svc = await fake();
    svc.failNext = 999;
    const o = await paidOrder("three_book_bundle", pick([V1, "en"], [V2, "de"], [V4, "en"]));
    await drainWorker();
    svc.failNext = 0;
    expect(o.item(V2).fulfillment_status).toBe("FAILED");
    expect(o.item(V1).fulfillment_status).toBe("COMPLETED");
    expect(o.order().fulfillment_status).toBe("FAILED");
    const d = await download(o.ref, o.token, o.item(V2).id);
    expect(d.status).toBe(409);
    expect(d.body.message).toBe("We could not prepare this language version yet. Please try again later.");
    const s = await status(o.ref, o.token);
    expect(s.items[1].stage).toBe("FAILED");
    expect(JSON.stringify(s)).not.toContain("Simulated");
    expect((await download(o.ref, o.token, o.item(V1).id)).status).toBe(200);

    // The admin's retry completes just the failed ebook.
    const { retryTranslation } = await import("@/lib/server/fulfillment");
    const job = (await db()).prepare("SELECT id FROM translation_jobs WHERE cache_key = ?").get(o.item(V2).cache_key) as { id: number };
    expect(retryTranslation(job.id)).toBe(true);
    await drainWorker();
    expect(o.item(V2).fulfillment_status).toBe("COMPLETED");
    expect(o.order().fulfillment_status).toBe("COMPLETED");
  });
});

describe("Cashfree checkout for bundles", () => {
  async function gatewayBundle() {
    const r = await placeOrder("three_book_bundle", pick([V1, "en"], [V2, "en"], [V4, "en"]));
    const create = await import("@/app/api/payment/create/route");
    const pay = await create.POST(jsonReq("/api/payment/create", { orderId: r.body.orderId }, { "x-order-token": r.body.accessToken }));
    return { ref: r.body.orderId as string, checkout: (await pay.json()).checkout };
  }
  async function sendWebhook(body: string) {
    const { POST } = await import("@/app/api/payment/webhook/route");
    const res = await POST(
      new Request(`${ORIGIN}/api/payment/webhook`, {
        method: "POST",
        body,
        headers: { "content-type": "application/json", "x-webhook-signature": signWebhook(body), "x-webhook-timestamp": WEBHOOK_TS },
      }),
    );
    return (await res.json()).message as string;
  }

  it("the gateway is asked for the bundle price (₹649)", async () => {
    const o = await gatewayBundle();
    expect(o.checkout).toMatchObject({ amount: 649, currency: "INR" });
    expect(cf.orders.get(o.ref)).toMatchObject({ order_amount: 649, order_id: o.ref });
  });

  it("paying the single-ebook price for a bundle does NOT mark it paid; the full price does", async () => {
    const o = await gatewayBundle();
    const { getOrderByRef } = await import("@/lib/server/orders");
    expect(await sendWebhook(webhookBody("PAYMENT_SUCCESS_WEBHOOK", cf.pay(o.ref, 299), cf.orders.get(o.ref)!))).toBe("Amount mismatch");
    expect(getOrderByRef(o.ref)!.payment_status).toBe("PENDING");
    const full = cf.pay(o.ref);
    expect(await sendWebhook(webhookBody("PAYMENT_SUCCESS_WEBHOOK", full, cf.orders.get(o.ref)!))).toBe("Payment recorded");
    expect(await sendWebhook(webhookBody("PAYMENT_SUCCESS_WEBHOOK", full, cf.orders.get(o.ref)!))).toBe("Duplicate ignored");
    expect(getOrderByRef(o.ref)!.payment_status).toBe("PAID");
  });
});

describe("Orders placed before packages", () => {
  it("are moved into order_items automatically, keeping their language, delivery state and downloads", async () => {
    const conn = await db();
    const legacy = Number(
      conn
        .prepare(`
          INSERT INTO orders (ref, product_slug, product_title, amount, buyer_name, email, whatsapp, utr, screenshot_file, screenshot_mime,
                              target_language, payment_status, fulfillment_status, cache_key, download_count)
          VALUES ('HM-LEGACY22', ?, 'Volume 4 — Intimacy After 50', 299, 'Old Customer', 'old@example.com', '919876543210', 'UTRLEGACY0001', 'x.png', 'image/png',
                  'fr', 'PAID', 'COMPLETED', 'volume-4:en:fr:v-000000000000', 2)
        `)
        .run(V4).lastInsertRowid,
    );
    // Simulate a restart: the schema upgrade runs when the database is opened.
    const g = globalThis as unknown as { __hmDb?: { close(): void } };
    g.__hmDb!.close();
    g.__hmDb = undefined;
    const { getOrderItems, getOrder } = await import("@/lib/server/orders");
    expect(getOrder(legacy)).toMatchObject({ package_type: "individual" });
    expect(getOrderItems(legacy)).toMatchObject([
      { book_slug: V4, target_language: "fr", fulfillment_status: "COMPLETED", cache_key: "volume-4:en:fr:v-000000000000", download_count: 2 },
    ]);
    // Opening again does not duplicate anything.
    g.__hmDb!.close();
    g.__hmDb = undefined;
    expect(getOrderItems(legacy)).toHaveLength(1);
  });
});
