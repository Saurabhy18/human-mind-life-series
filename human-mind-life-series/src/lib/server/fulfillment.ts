import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import { ENV, translationEnabled } from "@/config/env.server";
import { getBook } from "@/lib/products";
import { getDb } from "./db";
import { logger, errorMessage } from "./logger";
import { getOrder, getOrderByRef, type Order } from "./orders";
import { getStorage } from "./storageService";
import { bookReadyEmail, paymentReceivedEmail, sendEmail } from "./emailService";
import { getBookSource, translationCacheKey } from "./translation/bookSource";
import { getAvailableLanguages } from "./translation/languages";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

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

async function languageName(code: string): Promise<string> {
  const langs = await getAvailableLanguages();
  return langs.find((l) => l.code === code)?.name ?? code;
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
 * After payment: reuse a cached translation if one exists, otherwise queue a
 * single translation job per (book, source, target, source version). Never
 * runs the translation itself — the background worker does.
 */
export async function startFulfillment(orderId: number): Promise<void> {
  const db = getDb();
  const order = getOrder(orderId);
  if (!order || order.payment_status !== "PAID" || order.fulfillment_status === "COMPLETED") return;

  const book = getBook(order.product_slug);
  const source = book ? getBookSource(book) : null;
  if (!book || !source) {
    // No private source file (or a multi-book bundle): delivered manually by the admin, as before.
    event(orderId, "fulfillment", "Automatic delivery not available for this product — deliver manually.");
    return;
  }

  const key = translationCacheKey(book.slug, order.source_language, order.target_language, source.version);
  const cached = db.prepare("SELECT * FROM translated_books WHERE cache_key = ?").get(key) as { id: number; storage_key: string } | undefined;

  if (cached && (await getStorage().exists(cached.storage_key))) {
    db.prepare("UPDATE orders SET cache_key = ?, fulfillment_status = 'PROCESSING' WHERE id = ?").run(key, orderId);
    await completeOrdersForKey(key, cached.id);
    return;
  }

  if (order.target_language === order.source_language) {
    // The original language: no translation needed — store the original privately and deliver it.
    const storageKey = `originals/${book.slug}/${source.version}.pdf`;
    const bytes = new Uint8Array(fs.readFileSync(source.filePath));
    await getStorage().put(storageKey, bytes, "application/pdf");
    const info = db
      .prepare(`
        INSERT INTO translated_books (cache_key, book_slug, source_language, target_language, source_version, storage_key, bytes, sha256)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET storage_key = excluded.storage_key, bytes = excluded.bytes, sha256 = excluded.sha256
      `)
      .run(key, book.slug, order.source_language, order.target_language, source.version, storageKey, bytes.length, crypto.createHash("sha256").update(bytes).digest("hex"));
    const id = Number(info.lastInsertRowid) || (db.prepare("SELECT id FROM translated_books WHERE cache_key = ?").get(key) as { id: number }).id;
    db.prepare("UPDATE orders SET cache_key = ?, fulfillment_status = 'PROCESSING' WHERE id = ?").run(key, orderId);
    await completeOrdersForKey(key, id);
    return;
  }

  // Deduplicated job: INSERT OR IGNORE on the unique cache key. A previously FAILED job is re-queued.
  db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO translation_jobs (cache_key, book_slug, source_language, target_language, source_version, strategy)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(key, book.slug, order.source_language, order.target_language, source.version, ENV.translation.strategy);
    db.prepare(`
      UPDATE translation_jobs SET status = 'QUEUED', attempts = 0, next_attempt_at = datetime('now'), last_error = NULL, progress = 0, phase = NULL, updated_at = datetime('now')
      WHERE cache_key = ? AND status = 'FAILED'
    `).run(key);
    db.prepare("UPDATE orders SET cache_key = ?, fulfillment_status = 'PROCESSING', updated_at = datetime('now') WHERE id = ?").run(key, orderId);
  })();
  event(orderId, "fulfillment", `Translation queued (${order.target_language})`);
  if (!translationEnabled()) logger.warn("Translation job queued but no translation provider is configured", { orderId });

  if (!order.processing_email_sent_at) {
    const token = issueAccessToken(orderId, "email");
    const res = await sendEmail(
      paymentReceivedEmail({ to: order.email, name: order.buyer_name, bookTitle: book.title, languageName: await languageName(order.target_language), ref: order.ref, statusUrl: statusUrl(order.ref, token) }),
    );
    if (res.sent) db.prepare("UPDATE orders SET processing_email_sent_at = datetime('now') WHERE id = ?").run(orderId);
  }
}

/** Marks every paid order waiting for this translation as ready, and emails each customer. */
export async function completeOrdersForKey(cacheKey: string, translatedBookId: number): Promise<number[]> {
  const db = getDb();
  const ids = (
    db.prepare("SELECT id FROM orders WHERE cache_key = ? AND payment_status = 'PAID' AND fulfillment_status != 'COMPLETED'").all(cacheKey) as { id: number }[]
  ).map((r) => r.id);
  for (const id of ids) {
    db.prepare(`
      UPDATE orders SET fulfillment_status = 'COMPLETED', translated_book_id = ?, updated_at = datetime('now'),
        access_expires_at = datetime('now', '+' || ? || ' hours')
      WHERE id = ?
    `).run(translatedBookId, ENV.download.accessHours, id);
    event(id, "fulfillment", "Book ready for download");
    await sendReadyEmail(id);
  }
  return ids;
}

export async function sendReadyEmail(orderId: number): Promise<{ sent: boolean; reason?: string }> {
  const order = getOrder(orderId);
  if (!order || order.fulfillment_status !== "COMPLETED") return { sent: false, reason: "Book is not ready." };
  const book = getBook(order.product_slug);
  const token = issueAccessToken(orderId, "email");
  const res = await sendEmail(
    bookReadyEmail({
      to: order.email,
      name: order.buyer_name,
      bookTitle: book?.title ?? order.product_title,
      languageName: await languageName(order.target_language),
      ref: order.ref,
      statusUrl: statusUrl(order.ref, token),
      expiresHours: ENV.download.accessHours,
    }),
  );
  if (res.sent) getDb().prepare("UPDATE orders SET ready_email_sent_at = datetime('now') WHERE id = ?").run(orderId);
  else event(orderId, "email", `Ready email not sent: ${res.reason}`);
  return res.sent ? { sent: true } : { sent: false, reason: res.reason };
}

export function failOrdersForKey(cacheKey: string, reason: string) {
  const db = getDb();
  const ids = (db.prepare("SELECT id FROM orders WHERE cache_key = ? AND fulfillment_status = 'PROCESSING'").all(cacheKey) as { id: number }[]).map((r) => r.id);
  for (const id of ids) {
    db.prepare("UPDATE orders SET fulfillment_status = 'FAILED', updated_at = datetime('now') WHERE id = ?").run(id);
    event(id, "fulfillment", `Translation failed: ${reason}`);
  }
}

/** Admin: re-queues a failed translation and puts its orders back into processing. */
export function retryTranslation(jobId: number): boolean {
  const db = getDb();
  const job = db.prepare("SELECT cache_key FROM translation_jobs WHERE id = ? AND status = 'FAILED'").get(jobId) as { cache_key: string } | undefined;
  if (!job) return false;
  db.transaction(() => {
    db.prepare(`
      UPDATE translation_jobs SET status = 'QUEUED', attempts = 0, next_attempt_at = datetime('now'), last_error = NULL, progress = 0, phase = NULL, locked_until = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
    db.prepare("UPDATE orders SET fulfillment_status = 'PROCESSING', updated_at = datetime('now') WHERE cache_key = ? AND fulfillment_status = 'FAILED' AND payment_status = 'PAID'").run(job.cache_key);
  })();
  return true;
}

// ============================================================ Status =====

export type CustomerStage = "PAYMENT_PENDING" | "PAYMENT_FAILED" | "PAYMENT_SUCCESSFUL" | "PREPARING" | "TRANSLATING" | "GENERATING" | "READY" | "EXPIRED" | "FAILED" | "MANUAL_DELIVERY";

export function customerStatus(order: Order) {
  const job = order.cache_key
    ? (getDb().prepare("SELECT status, phase, progress FROM translation_jobs WHERE cache_key = ?").get(order.cache_key) as { status: string; phase: string | null; progress: number } | undefined)
    : undefined;
  let stage: CustomerStage;
  let progress = 0;
  if (order.payment_status === "FAILED") stage = "PAYMENT_FAILED";
  else if (order.payment_status !== "PAID") stage = "PAYMENT_PENDING";
  else if (order.fulfillment_status === "COMPLETED") {
    const expired = order.access_expires_at ? new Date(order.access_expires_at.replace(" ", "T") + "Z") < new Date() : false;
    stage = expired ? "EXPIRED" : "READY";
    progress = 100;
  } else if (order.fulfillment_status === "FAILED") stage = "FAILED";
  else if (order.fulfillment_status === "PROCESSING") {
    progress = job?.progress ?? 0;
    stage = job?.phase === "GENERATING" || job?.phase === "STORING" ? "GENERATING" : job?.status === "PROCESSING" ? (job.phase === "PREPARING" ? "PREPARING" : "TRANSLATING") : "PREPARING";
  } else stage = getBook(order.product_slug) && getBookSource(order.product_slug) ? "PAYMENT_SUCCESSFUL" : "MANUAL_DELIVERY";

  return {
    orderId: order.ref,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    stage,
    progress,
    targetLanguage: order.target_language,
    downloadsRemaining: Math.max(0, ENV.download.maxDownloads - order.download_count),
    accessExpiresAt: order.access_expires_at ? new Date(order.access_expires_at.replace(" ", "T") + "Z").toISOString() : null,
  };
}

// =========================================================== Downloads =====

export type DownloadDecision =
  | { ok: true; url: string; expiresInSeconds: number }
  | { ok: false; status: number; code: "NOT_PAID" | "NOT_READY" | "EXPIRED" | "LIMIT_REACHED" | "UNAVAILABLE"; message: string };

/** Issues a short-lived signed URL only for a PAID + COMPLETED order within its access window and download limit. */
export async function requestDownload(order: Order, ctx: { ipHash: string; userAgent: string }): Promise<DownloadDecision> {
  const db = getDb();
  const log = (evt: string) => db.prepare("INSERT INTO download_logs (order_id, event, ip_hash, user_agent) VALUES (?, ?, ?, ?)").run(order.id, evt, ctx.ipHash, ctx.userAgent.slice(0, 300));

  if (order.payment_status !== "PAID") {
    log("denied:not_paid");
    return { ok: false, status: 402, code: "NOT_PAID", message: "Payment has not been confirmed for this order yet." };
  }
  if (order.fulfillment_status !== "COMPLETED" || !order.translated_book_id) {
    log("denied:not_ready");
    return { ok: false, status: 409, code: "NOT_READY", message: "Your book is still being prepared." };
  }
  if (order.access_expires_at && new Date(order.access_expires_at.replace(" ", "T") + "Z") < new Date()) {
    log("denied:expired");
    return { ok: false, status: 410, code: "EXPIRED", message: "This download period has ended. Please contact us and we will help." };
  }
  // Atomically use one download (prevents racing past the limit).
  const res = db.prepare("UPDATE orders SET download_count = download_count + 1 WHERE id = ? AND download_count < ?").run(order.id, ENV.download.maxDownloads);
  if (res.changes !== 1) {
    log("denied:limit");
    return { ok: false, status: 429, code: "LIMIT_REACHED", message: "The maximum number of downloads for this order has been reached. Please contact us." };
  }
  const tb = db.prepare("SELECT storage_key, target_language FROM translated_books WHERE id = ?").get(order.translated_book_id) as { storage_key: string; target_language: string } | undefined;
  if (!tb) {
    db.prepare("UPDATE orders SET download_count = download_count - 1 WHERE id = ?").run(order.id);
    log("denied:missing_file");
    return { ok: false, status: 503, code: "UNAVAILABLE", message: "Your book is temporarily unavailable. Please try again shortly." };
  }
  const book = getBook(order.product_slug);
  const name = `${(book?.title ?? "book").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${tb.target_language}.pdf`;
  try {
    const url = await getStorage().signedUrl(tb.storage_key, { ttlSeconds: ENV.download.urlTtlSeconds, downloadName: name });
    log("issued");
    return { ok: true, url, expiresInSeconds: ENV.download.urlTtlSeconds };
  } catch (err) {
    db.prepare("UPDATE orders SET download_count = download_count - 1 WHERE id = ?").run(order.id);
    logger.error("Signed URL failed", { orderId: order.id, error: errorMessage(err) });
    log("denied:error");
    return { ok: false, status: 503, code: "UNAVAILABLE", message: "Your book is temporarily unavailable. Please try again shortly." };
  }
}

