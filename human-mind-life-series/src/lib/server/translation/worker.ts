import "server-only";
import { ENV } from "@/config/env.server";
import { getDb } from "../db";
import { logger, errorMessage } from "../logger";
import { completeOrdersForKey, failOrdersForKey } from "../fulfillment";
import { getBookSource } from "./bookSource";
import { translateBook } from "./bookTranslationService";
import { getTranslationService } from "./googleTranslationService";
import { hasTextLayer } from "./parsers/pdfParser";

export type JobRow = {
  id: number;
  cache_key: string;
  book_slug: string;
  source_language: string;
  target_language: string;
  source_version: string;
  strategy: "document" | "text";
  status: string;
  attempts: number;
};

/**
 * Claims the next due job (or one whose previous worker died) with a lease.
 * The single UPDATE … RETURNING is atomic, so two workers never take the same job.
 */
export function claimNextJob(): JobRow | null {
  const row = getDb()
    .prepare(`
      UPDATE translation_jobs
      SET status = 'PROCESSING', attempts = attempts + 1, phase = 'PREPARING',
          locked_until = datetime('now', '+' || ? || ' minutes'),
          started_at = COALESCE(started_at, datetime('now')), updated_at = datetime('now')
      WHERE id = (
        SELECT id FROM translation_jobs
        WHERE (status = 'QUEUED' AND next_attempt_at <= datetime('now'))
           OR (status = 'PROCESSING' AND locked_until < datetime('now'))
        ORDER BY id LIMIT 1
      )
      RETURNING *
    `)
    .get(ENV.worker.leaseMinutes) as JobRow | undefined;
  return row ?? null;
}

/** Runs one job end to end. Never throws: failures are recorded and retried with exponential backoff. */
export async function runJob(job: JobRow): Promise<"COMPLETED" | "RETRY" | "FAILED"> {
  const db = getDb();
  const started = Date.now();
  const setProgress = (phase: string, percent: number) => {
    db.prepare("UPDATE translation_jobs SET phase = ?, progress = ?, locked_until = datetime('now', '+' || ? || ' minutes'), updated_at = datetime('now') WHERE id = ?").run(
      phase,
      Math.max(0, Math.min(100, Math.round(percent))),
      ENV.worker.leaseMinutes,
      job.id,
    );
  };

  try {
    const svc = getTranslationService();
    if (!svc) throw new Error("No translation provider is configured (set GOOGLE_CLOUD_PROJECT_ID).");
    const source = getBookSource(job.book_slug);
    if (!source) throw new Error(`Source PDF missing: storage/books/${job.book_slug}.pdf`);
    if (source.version !== job.source_version) {
      // The English book changed after this job was queued — this cache key is obsolete.
      throw Object.assign(new Error(`Source changed (${job.source_version} → ${source.version}); new orders will use the new version.`), { permanent: true });
    }
    if (!(await hasTextLayer(source.filePath))) {
      // A scanned book would come back untranslated (text strategy) or be rejected by Google (document strategy).
      throw Object.assign(
        new Error(`storage/books/${job.book_slug}.pdf has no selectable text (scanned / image-only). Run OCR on it, upload it again, then use “Retry automatic delivery” on each affected order.`),
        { permanent: true },
      );
    }

    logger.info("Translation started", { jobId: job.id, key: job.cache_key, attempt: job.attempts });
    const result = await translateBook(
      svc,
      {
        jobId: job.id,
        bookSlug: job.book_slug,
        sourceFile: source.filePath,
        sourceLanguage: job.source_language,
        targetLanguage: job.target_language,
        sourceVersion: job.source_version,
        strategy: job.strategy,
      },
      setProgress,
    );

    const tbId = db.transaction(() => {
      db.prepare(`
        INSERT INTO translated_books (cache_key, book_slug, source_language, target_language, source_version, storage_key, bytes, sha256, job_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET storage_key = excluded.storage_key, bytes = excluded.bytes, sha256 = excluded.sha256, job_id = excluded.job_id
      `).run(job.cache_key, job.book_slug, job.source_language, job.target_language, job.source_version, result.storageKey, result.bytes, result.sha256, job.id);
      db.prepare(`
        UPDATE translation_jobs SET status = 'COMPLETED', phase = 'DONE', progress = 100, locked_until = NULL, last_error = NULL,
          chars_translated = ?, pages_translated = ?, est_cost_usd = est_cost_usd + ?, finished_at = datetime('now'), duration_ms = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(result.charsTranslated, result.pagesTranslated, result.estCostUsd, Date.now() - started, job.id);
      return (db.prepare("SELECT id FROM translated_books WHERE cache_key = ?").get(job.cache_key) as { id: number }).id;
    })();

    const orders = await completeOrdersForKey(job.cache_key, tbId);
    logger.info("Translation completed", { jobId: job.id, orders: orders.length, ms: Date.now() - started, chars: result.charsTranslated, pages: result.pagesTranslated });
    return "COMPLETED";
  } catch (err) {
    const message = errorMessage(err);
    const permanent = (err as { permanent?: boolean }).permanent === true;
    if (!permanent && job.attempts < ENV.translation.maxAttempts) {
      const delay = ENV.translation.retryBaseSeconds * 2 ** (job.attempts - 1);
      db.prepare(`
        UPDATE translation_jobs SET status = 'QUEUED', phase = NULL, locked_until = NULL, last_error = ?,
          next_attempt_at = datetime('now', '+' || ? || ' seconds'), updated_at = datetime('now')
        WHERE id = ?
      `).run(message, delay, job.id);
      logger.warn("Translation failed; will retry", { jobId: job.id, attempt: job.attempts, retryInSeconds: delay, error: message });
      return "RETRY";
    }
    db.prepare("UPDATE translation_jobs SET status = 'FAILED', phase = NULL, locked_until = NULL, last_error = ?, finished_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
      message,
      job.id,
    );
    failOrdersForKey(job.cache_key, message);
    logger.error("Translation failed permanently", { jobId: job.id, attempts: job.attempts, error: message });
    return "FAILED";
  }
}

/** Processes at most one job. Returns false when there was nothing to do. */
export async function runWorkerOnce(): Promise<boolean> {
  const job = claimNextJob();
  if (!job) return false;
  await runJob(job);
  return true;
}
