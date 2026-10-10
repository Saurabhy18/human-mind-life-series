import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import { ENV, translationEnabled } from "@/config/env.server";
import { getPackage } from "@/config/packages";
import { getBook } from "@/lib/products";
import { getDb } from "./db";
import { logger, errorMessage } from "./logger";
import { getOrder, getOrderByRef, getOrderItems, type FulfillmentStatus, type Order, type OrderItem } from "./orders";
import { getStorage } from "./storageService";
import { bookReadyEmail, paymentReceivedEmail, sendEmail, type EmailBook } from "./emailService";
import { getBookSource, translationCacheKey } from "./translation/bookSource";
import { getAvailableLanguages } from "./translation/languages";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const utc = (s: string) => new Date(s.replace(" ", "T") + "Z");

function event(orderId: number, status: string, note: string) {
  getDb().prepare("INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)").run(orderId, status, note);
}

// ===================================================== Customer access =====

/** Issues a new secret link token for an order. Only its hash is stored; the raw token is shown/sent once. */
export function issueAccessToken(orderId: number, purpose: "checkout" | "email" | "admin"): string {
  const token = crypto.randomBytes(32).toString("base64url");
  getDb().prepare("INSERT INTO order_access_tokens (order_id, token_hash, purpose) VALUES (?, ?, ?)").run(orderId, sha(token), purpose);
  return token;
}

/** Customer authorization: returns the order only if `token` is one of ITS tokens. */
export function authorizeOrder(ref: unknown, token: unknown): Order | null {
  if (typeof ref !== "string" || !/^HM-[A-Z0-9]{8}$/.test(ref)) return null;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const order = getOrderByRef(ref);
  if (!order) return null;
  const row = getDb().prepare("SELECT 1 FROM order_access_tokens WHERE order_id = ? AND token_hash = ?").get(order.id, sha(token));
  return row ? order : null;
}

export function statusUrl(ref: string, token: string): string {
  return `${ENV.frontendUrl}/order/status/${ref}#t=${token}`;
}

/** Code → English language name, from the same list customers choose from. */
async function languageNames(): Promise<(code: string) => string> {
  const langs = await getAvailableLanguages();
  return (code) => langs.find((l) => l.code === code)?.name ?? code;
}

// ============================================================ Payments =====

export type PaymentConfirmation = {
  orderId: number;
  provider: "manual_upi" | "razorpay";
  /** Unique per real payment event (gateway event id / payment id / admin verification). Makes processing idempotent. */
  idempotencyKey: string;
  amount: number;
  currency: string;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  rawEvent?: string | null;
};

/**
 * Records a VERIFIED payment (gateway webhook after signature + amount checks,
 * or an admin who confirmed the money in the bank) and starts fulfillment.
 * Calling it again with the same idempotency key does nothing.
 */
export async function markOrderPaid(p: PaymentConfirmation): Promise<{ duplicate: boolean }> {
  const db = getDb();
  const changed = db.transaction(() => {
    const exists = db.prepare("SELECT 1 FROM payments WHERE idempotency_key = ?").get(p.idempotencyKey);
    if (exists) return false;
    db.prepare(`
      INSERT INTO payments (order_id, provider, idempotency_key, provider_payment_id, provider_order_id, amount, currency, status, raw_event)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?)
    `).run(p.orderId, p.provider, p.idempotencyKey, p.providerPaymentId ?? null, p.providerOrderId ?? null, p.amount, p.currency, p.rawEvent ?? null);
    const res = db
      .prepare(`
        UPDATE orders SET payment_status = 'PAID', paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now'),
          status = CASE WHEN status = 'pending' THEN 'verified' ELSE status END,
          verified_at = COALESCE(verified_at, datetime('now'))
        WHERE id = ? AND payment_status != 'PAID'
      `)
      .run(p.orderId);
    if (res.changes) event(p.orderId, "verified", `Payment confirmed (${p.provider})`);
    return true;
  })();
  if (!changed) return { duplicate: true };
  await startFulfillment(p.orderId);
  return { duplicate: false };
}

export function markOrderPaymentFailed(orderId: number, note: string) {
  getDb().prepare("UPDATE orders SET payment_status = 'FAILED', updated_at = datetime('now') WHERE id = ? AND payment_status = 'PENDING'").run(orderId);
  event(orderId, "payment_failed", note);
}

// ========================================================= Fulfillment =====

/**
 * After payment, for EACH ebook in the order (in its own language): reuse the
 * stored PDF if this book + language was prepared before, otherwise queue ONE
 * translation job per (book, source, target, source version), shared by every
 * order that needs it. Never translates inside this request — the background
 * worker does. Ebooks already started are left alone, so this is safe to repeat.
 * `retryFailed` (admin) also restarts failed ebooks, using the CURRENT source PDF.
 */
export async function startFulfillment(orderId: number, opts: { retryFailed?: boolean } = {}): Promise<void> {
  const order = getOrder(orderId);
  if (!order || order.payment_status !== "PAID") return;
  let queued = 0;
  for (const item of getOrderItems(orderId)) {
    const startable = item.fulfillment_status === "NOT_STARTED" || (opts.retryFailed && item.fulfillment_status === "FAILED");
    if (startable && (await startItem(order, item))) queued++;
  }
  refreshOrderFulfillment(orderId);
  if (queued > 0) await sendProcessingEmail(orderId);
  await maybeSendReadyEmail(orderId);
}

/** Starts delivery of one ebook. Returns true when a translation had to be queued (i.e. it is not ready yet). */
async function startItem(order: Order, item: OrderItem): Promise<boolean> {
  const db = getDb();
  const book = getBook(item.book_slug);
  const source = book ? getBookSource(book) : null;
  if (!book || !source) {
    // No private source file: delivered manually by the admin, as before.
    event(order.id, "fulfillment", `${item.book_title}: automatic delivery not available — deliver manually.`);
    return false;
  }

  const key = translationCacheKey(book.slug, item.source_language, item.target_language, source.version);
  const cached = db.prepare("SELECT id, storage_key FROM translated_books WHERE cache_key = ?").get(key) as { id: number; storage_key: string } | undefined;
  if (cached && (await getStorage().exists(cached.storage_key))) {
    db.prepare("UPDATE order_items SET cache_key = ?, updated_at = datetime('now') WHERE id = ?").run(key, item.id);
    completeItem(item.id, cached.id);
    event(order.id, "fulfillment", `${item.book_title} (${item.target_language}): ready — existing edition reused`);
    return false;
  }

  if (item.target_language === item.source_language) {
    // The original language: no translation needed — store the original privately and deliver it.
    const storageKey = `originals/${book.slug}/${source.version}.pdf`;
    const bytes = new Uint8Array(fs.readFileSync(source.filePath));
    await getStorage().put(storageKey, bytes, "application/pdf");
    db.prepare(`
      INSERT INTO translated_books (cache_key, book_slug, source_language, target_language, source_version, storage_key, bytes, sha256)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET storage_key = excluded.storage_key, bytes = excluded.bytes, sha256 = excluded.sha256
    `).run(key, book.slug, item.source_language, item.target_language, source.version, storageKey, bytes.length, crypto.createHash("sha256").update(bytes).digest("hex"));
    const id = (db.prepare("SELECT id FROM translated_books WHERE cache_key = ?").get(key) as { id: number }).id;
    db.prepare("UPDATE order_items SET cache_key = ?, updated_at = datetime('now') WHERE id = ?").run(key, item.id);
    completeItem(item.id, id);
    event(order.id, "fulfillment", `${item.book_title} (${item.target_language}): ready`);
    return false;
  }

  // Deduplicated job: INSERT OR IGNORE on the unique cache key. A FAILED job is re-queued, and so is a
  // COMPLETED one whose stored file has gone missing. If the worker finished this exact translation a
  // moment ago (after the check above), the ebook is completed straight away instead of waiting forever.
  const fileMissing = !!cached;
  const justFinished = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO translation_jobs (cache_key, book_slug, source_language, target_language, source_version, strategy)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(key, book.slug, item.source_language, item.target_language, source.version, ENV.translation.strategy);
    db.prepare(`
      UPDATE translation_jobs SET status = 'QUEUED', attempts = 0, next_attempt_at = datetime('now'), last_error = NULL, progress = 0, phase = NULL, updated_at = datetime('now')
      WHERE cache_key = ? AND (status = 'FAILED' OR (status = 'COMPLETED' AND ?))
    `).run(key, fileMissing ? 1 : 0);
    db.prepare("UPDATE order_items SET cache_key = ?, fulfillment_status = 'PROCESSING', updated_at = datetime('now') WHERE id = ?").run(key, item.id);
    if (fileMissing) return undefined;
    return db.prepare("SELECT id FROM translated_books WHERE cache_key = ?").get(key) as { id: number } | undefined;
  })();
  if (justFinished) {
    completeItem(item.id, justFinished.id);
    event(order.id, "fulfillment", `${item.book_title} (${item.target_language}): ready`);
    return false;
  }
  event(order.id, "fulfillment", `${item.book_title}: translation queued (${item.target_language})`);
  if (!translationEnabled()) logger.warn("Translation job queued but no translation provider is configured", { orderId: order.id });
  return true;
}

/** Marks one ebook ready and starts its download period. */
function completeItem(itemId: number, translatedBookId: number) {
  getDb()
    .prepare(`
      UPDATE order_items SET fulfillment_status = 'COMPLETED', translated_book_id = ?, updated_at = datetime('now'),
        access_expires_at = datetime('now', '+' || ? || ' hours')
      WHERE id = ? AND fulfillment_status != 'COMPLETED'
    `)
    .run(translatedBookId, ENV.download.accessHours, itemId);
}

/**
 * Keeps orders.fulfillment_status as a summary of its ebooks:
 * PROCESSING (any being prepared) > FAILED (any failed) > NOT_STARTED (any needs manual delivery) > COMPLETED (all ready).
 */
export function refreshOrderFulfillment(orderId: number): FulfillmentStatus {
  const statuses = new Set(getOrderItems(orderId).map((i) => i.fulfillment_status));
  const status: FulfillmentStatus = statuses.has("PROCESSING") ? "PROCESSING" : statuses.has("FAILED") ? "FAILED" : statuses.has("NOT_STARTED") || statuses.size === 0 ? "NOT_STARTED" : "COMPLETED";
  getDb().prepare("UPDATE orders SET fulfillment_status = ?, updated_at = datetime('now') WHERE id = ? AND fulfillment_status != ?").run(status, orderId, status);
  return status;
}

/** Called by the worker when a translation is stored: every paid order waiting for it gets that ebook. Returns the order ids. */
export async function completeOrdersForKey(cacheKey: string, translatedBookId: number): Promise<number[]> {
  const db = getDb();
  const rows = db
    .prepare(`
      SELECT i.id, i.order_id, i.book_title, i.target_language FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE i.cache_key = ? AND o.payment_status = 'PAID' AND i.fulfillment_status != 'COMPLETED'
    `)
    .all(cacheKey) as { id: number; order_id: number; book_title: string; target_language: string }[];
  for (const r of rows) {
    completeItem(r.id, translatedBookId);
    event(r.order_id, "fulfillment", `${r.book_title} (${r.target_language}): ready for download`);
  }
  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  for (const id of orderIds) {
    refreshOrderFulfillment(id);
    await maybeSendReadyEmail(id);
  }
  return orderIds;
}

export function failOrdersForKey(cacheKey: string, reason: string) {
  const db = getDb();
  const rows = db.prepare("SELECT id, order_id, book_title FROM order_items WHERE cache_key = ? AND fulfillment_status = 'PROCESSING'").all(cacheKey) as { id: number; order_id: number; book_title: string }[];
  for (const r of rows) {
    db.prepare("UPDATE order_items SET fulfillment_status = 'FAILED', updated_at = datetime('now') WHERE id = ?").run(r.id);
    // Internal detail for the admin's order history only — customers see a generic message.
    event(r.order_id, "fulfillment", `${r.book_title}: translation failed: ${reason}`);
  }
  for (const id of new Set(rows.map((r) => r.order_id))) refreshOrderFulfillment(id);
}

/** Admin: re-queues a failed translation and puts its ebooks back into processing. */
export function retryTranslation(jobId: number): boolean {
  const db = getDb();
  const job = db.prepare("SELECT cache_key FROM translation_jobs WHERE id = ? AND status = 'FAILED'").get(jobId) as { cache_key: string } | undefined;
  if (!job) return false;
  const orderIds = db.transaction(() => {
    db.prepare(`
      UPDATE translation_jobs SET status = 'QUEUED', attempts = 0, next_attempt_at = datetime('now'), last_error = NULL, progress = 0, phase = NULL, locked_until = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
    const ids = (
      db
        .prepare(`
          UPDATE order_items SET fulfillment_status = 'PROCESSING', updated_at = datetime('now')
          WHERE cache_key = ? AND fulfillment_status = 'FAILED' AND order_id IN (SELECT id FROM orders WHERE payment_status = 'PAID')
          RETURNING order_id
        `)
        .all(job.cache_key) as { order_id: number }[]
    ).map((r) => r.order_id);
    return [...new Set(ids)];
  })();
  for (const id of orderIds) refreshOrderFulfillment(id);
  return true;
}

// ============================================================== Emails =====

async function emailBooks(orderId: number): Promise<EmailBook[]> {
  const name = await languageNames();
  return getOrderItems(orderId).map((i) => ({
    title: getBook(i.book_slug)?.title ?? i.book_title,
    languageName: name(i.target_language),
    state: i.fulfillment_status === "COMPLETED" ? "ready" : i.fulfillment_status === "PROCESSING" ? "preparing" : i.fulfillment_status === "FAILED" ? "delayed" : "manual",
  }));
}

/** "Payment received — being prepared" (once per order), when at least one ebook needs translating. */
async function sendProcessingEmail(orderId: number) {
  const order = getOrder(orderId);
  if (!order || order.processing_email_sent_at) return;
  const token = issueAccessToken(orderId, "email");
  const res = await sendEmail(paymentReceivedEmail({ to: order.email, name: order.buyer_name, ref: order.ref, statusUrl: statusUrl(order.ref, token), books: await emailBooks(orderId) }));
  if (res.sent) getDb().prepare("UPDATE orders SET processing_email_sent_at = datetime('now') WHERE id = ?").run(orderId);
}

/** Sends the "ready" email once nothing is still being prepared and at least one ebook can be downloaded. */
async function maybeSendReadyEmail(orderId: number) {
  const order = getOrder(orderId);
  if (!order || order.ready_email_sent_at) return;
  const items = getOrderItems(orderId);
  if (items.some((i) => i.fulfillment_status === "PROCESSING") || !items.some((i) => i.fulfillment_status === "COMPLETED")) return;
  await sendReadyEmail(orderId);
}

export async function sendReadyEmail(orderId: number): Promise<{ sent: boolean; reason?: string }> {
  const order = getOrder(orderId);
  if (!order || !getOrderItems(orderId).some((i) => i.fulfillment_status === "COMPLETED")) return { sent: false, reason: "No ebook is ready yet." };
  const token = issueAccessToken(orderId, "email");
  const res = await sendEmail(
    bookReadyEmail({ to: order.email, name: order.buyer_name, ref: order.ref, statusUrl: statusUrl(order.ref, token), expiresHours: ENV.download.accessHours, books: await emailBooks(orderId) }),
  );
  if (res.sent) getDb().prepare("UPDATE orders SET ready_email_sent_at = datetime('now') WHERE id = ?").run(orderId);
  else event(orderId, "email", `Ready email not sent: ${res.reason}`);
  return res.sent ? { sent: true } : { sent: false, reason: res.reason };
}

// ============================================================ Status =====

export type CustomerStage = "PAYMENT_PENDING" | "PAYMENT_FAILED" | "PAYMENT_SUCCESSFUL" | "PREPARING" | "TRANSLATING" | "GENERATING" | "READY" | "EXPIRED" | "FAILED" | "MANUAL_DELIVERY";

const WORKING: CustomerStage[] = ["PAYMENT_SUCCESSFUL", "PREPARING", "TRANSLATING", "GENERATING"];

export type CustomerItemStatus = {
  itemId: number;
  bookId: string;
  title: string;
  volumeLabel: string | null;
  targetLanguage: string;
  languageName: string;
  stage: CustomerStage;
  progress: number;
  downloadsRemaining: number;
  accessExpiresAt: string | null;
};

function itemStage(order: Order, item: OrderItem): { stage: CustomerStage; progress: number } {
  if (order.payment_status === "FAILED") return { stage: "PAYMENT_FAILED", progress: 0 };
  if (order.payment_status !== "PAID") return { stage: "PAYMENT_PENDING", progress: 0 };
  switch (item.fulfillment_status) {
    case "COMPLETED":
      return { stage: item.access_expires_at && utc(item.access_expires_at) < new Date() ? "EXPIRED" : "READY", progress: 100 };
    case "FAILED":
      return { stage: "FAILED", progress: 0 };
    case "PROCESSING": {
      const job = item.cache_key
        ? (getDb().prepare("SELECT status, phase, progress FROM translation_jobs WHERE cache_key = ?").get(item.cache_key) as { status: string; phase: string | null; progress: number } | undefined)
        : undefined;
      const stage: CustomerStage =
        job?.phase === "GENERATING" || job?.phase === "STORING" ? "GENERATING" : job?.status === "PROCESSING" && job.phase !== "PREPARING" ? "TRANSLATING" : "PREPARING";
      return { stage, progress: job?.progress ?? 0 };
    }
    default:
      return { stage: getBookSource(item.book_slug) ? "PAYMENT_SUCCESSFUL" : "MANUAL_DELIVERY", progress: 0 };
  }
}

/** One overall stage for the order (the least advanced ebook decides while anything is still being prepared). */
function overallStage(stages: CustomerStage[]): CustomerStage {
  if (stages.length === 1) return stages[0];
  const working = stages.filter((s) => WORKING.includes(s));
  if (working.length) return WORKING.find((w) => working.includes(w))!;
  for (const s of ["PAYMENT_FAILED", "PAYMENT_PENDING", "FAILED", "MANUAL_DELIVERY", "READY"] as const) if (stages.includes(s)) return s;
  return "EXPIRED";
}

/** The customer's view of their order: payment, and each ebook with its language, progress and downloads left. */
export async function customerStatus(order: Order) {
  const name = await languageNames();
  const items: CustomerItemStatus[] = getOrderItems(order.id).map((i) => {
    const book = getBook(i.book_slug);
    return {
      itemId: i.id,
      bookId: i.book_slug,
      title: book?.title ?? i.book_title,
      volumeLabel: book?.volumeLabel ?? null,
      targetLanguage: i.target_language,
      languageName: name(i.target_language),
      ...itemStage(order, i),
      downloadsRemaining: Math.max(0, ENV.download.maxDownloads - i.download_count),
      accessExpiresAt: i.access_expires_at ? utc(i.access_expires_at).toISOString() : null,
    };
  });
  const first = items[0];
  return {
    orderId: order.ref,
    packageType: order.package_type,
    packageName: getPackage(order.package_type)?.name ?? order.product_title,
    amount: order.amount,
    currency: order.currency,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    stage: overallStage(items.map((i) => i.stage)),
    progress: items.length ? Math.round(items.reduce((n, i) => n + i.progress, 0) / items.length) : 0,
    // For single-ebook orders (and older clients): the first ebook's details.
    targetLanguage: first?.targetLanguage ?? order.target_language,
    downloadsRemaining: first?.downloadsRemaining ?? 0,
    accessExpiresAt: first?.accessExpiresAt ?? null,
    items,
  };
}

// =========================================================== Downloads =====

export type DownloadDecision =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; status: number; code: "NOT_PAID" | "NOT_READY" | "EXPIRED" | "LIMIT_REACHED" | "UNAVAILABLE"; message: string };

/**
 * Issues a short-lived signed URL for ONE ebook of an order, only when: the order is PAID, the ebook
 * belongs to this order (the caller looked it up with getOrderItem), it is ready, its download period
 * hasn't ended and its download limit isn't reached. A customer can only ever get the books AND
 * languages they paid for, because only those exist as items of their order.
 */
export async function requestDownload(order: Order, item: OrderItem, ctx: { ipHash: string; userAgent: string }): Promise<DownloadDecision> {
  const db = getDb();
  const log = (evt: string) =>
    db.prepare("INSERT INTO download_logs (order_id, item_id, event, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?)").run(order.id, item.id, evt, ctx.ipHash, ctx.userAgent.slice(0, 300));
  const unavailable = { ok: false, status: 503, code: "UNAVAILABLE", message: "Your ebook is temporarily unavailable. Please try again shortly." } as const;

  if (item.order_id !== order.id) throw new Error("Item does not belong to this order");
  if (order.payment_status !== "PAID") {
    log("denied:not_paid");
    return { ok: false, status: 402, code: "NOT_PAID", message: "Your payment is being verified. Please wait." };
  }
  if (item.fulfillment_status !== "COMPLETED" || !item.translated_book_id) {
    log("denied:not_ready");
    const message = item.fulfillment_status === "FAILED" ? "We could not prepare this language version yet. Please try again later." : "Your selected-language ebook is being prepared.";
    return { ok: false, status: 409, code: "NOT_READY", message };
  }
  if (item.access_expires_at && utc(item.access_expires_at) < new Date()) {
    log("denied:expired");
    return { ok: false, status: 410, code: "EXPIRED", message: "This download period has ended. Please contact us and we will help." };
  }
  // Atomically use one download of THIS ebook (prevents racing past the limit).
  const res = db.prepare("UPDATE order_items SET download_count = download_count + 1 WHERE id = ? AND download_count < ?").run(item.id, ENV.download.maxDownloads);
  if (res.changes !== 1) {
    log("denied:limit");
    return { ok: false, status: 429, code: "LIMIT_REACHED", message: "The maximum number of downloads for this ebook has been reached. Please contact us." };
  }
  const undo = () => db.prepare("UPDATE order_items SET download_count = download_count - 1 WHERE id = ?").run(item.id);
  const tb = db.prepare("SELECT storage_key, target_language FROM translated_books WHERE id = ?").get(item.translated_book_id) as { storage_key: string; target_language: string } | undefined;
  if (!tb) {
    undo();
    log("denied:missing_file");
    return unavailable;
  }
  const book = getBook(item.book_slug);
  const ascii = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const language = ascii((await languageNames())(tb.target_language)) || tb.target_language;
  const name = `${ascii(book?.title ?? "book") || "book"}-${language}.pdf`; // e.g. Intimacy-After-50-Hindi.pdf
  try {
    const url = await getStorage().signedUrl(tb.storage_key, { ttlSeconds: ENV.download.urlTtlSeconds, downloadName: name });
    db.prepare("UPDATE orders SET download_count = download_count + 1 WHERE id = ?").run(order.id); // order total, shown in the admin list
    log("issued");
    return { ok: true, url, expiresInSeconds: ENV.download.urlTtlSeconds };
  } catch (err) {
    undo();
    logger.error("Signed URL failed", { orderId: order.id, itemId: item.id, error: errorMessage(err) });
    log("denied:error");
    return unavailable;
  }
}
