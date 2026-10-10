import crypto from "node:crypto";

/** Creates an order the way the UPI flow does, then confirms payment server-side (as the admin would). */
export async function createOrder(slug: string, lang: string, opts: { pay?: boolean } = {}) {
  const { createOrder: create, getOrder } = await import("@/lib/server/orders");
  const { issueAccessToken, markOrderPaid } = await import("@/lib/server/fulfillment");
  const { getProduct } = await import("@/lib/products");
  const p = getProduct(slug)!;
  const { id, ref } = create({
    product_slug: p.slug,
    product_title: p.label,
    amount: p.price,
    amount_paid: p.price,
    author: p.author,
    buyer_name: "Test Reader",
    email: `reader+${crypto.randomUUID().slice(0, 8)}@example.com`,
    whatsapp: "919876543210",
    utr: `UTR${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
    screenshot_file: "x.png",
    screenshot_mime: "image/png",
    utm_json: null,
    ip_hash: "test",
    user_agent: "vitest",
    source_language: "en",
    target_language: lang,
    currency: "INR",
    payment_provider: "manual_upi",
  });
  const token = issueAccessToken(id, "checkout");
  if (opts.pay !== false) {
    await markOrderPaid({ orderId: id, provider: "manual_upi", idempotencyKey: `manual_upi:order:${id}`, amount: p.price, currency: "INR" });
  }
  return { id, ref, token, get: () => getOrder(id)! };
}

/** Runs the background worker until there is nothing left to do (retries made due immediately). */
export async function drainWorker(maxRounds = 20) {
  const { runWorkerOnce } = await import("@/lib/server/translation/worker");
  const { getDb } = await import("@/lib/server/db");
  for (let i = 0; i < maxRounds; i++) {
    getDb().prepare("UPDATE translation_jobs SET next_attempt_at = datetime('now', '-1 second') WHERE status = 'QUEUED'").run();
    if (!(await runWorkerOnce())) return;
  }
}

/** Extracts all text from a PDF (to check the translated output). */
export async function pdfText(bytes: Uint8Array): Promise<{ pages: string[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  await task.destroy();
  return { pages };
}
