import "server-only";
import { getDb } from "./db";

export type JobListRow = {
  id: number;
  cache_key: string;
  book_slug: string;
  source_language: string;
  target_language: string;
  source_version: string;
  strategy: string;
  status: string;
  phase: string | null;
  progress: number;
  attempts: number;
  last_error: string | null;
  chars_translated: number;
  pages_translated: number;
  est_cost_usd: number;
  duration_ms: number | null;
  created_at: string;
  finished_at: string | null;
  translated_book_id: number | null;
  orders: number;
};

export function listJobs(): JobListRow[] {
  return getDb()
    .prepare(`
      SELECT j.*, tb.id AS translated_book_id,
             (SELECT COUNT(*) FROM order_items i WHERE i.cache_key = j.cache_key) AS orders
      FROM translation_jobs j LEFT JOIN translated_books tb ON tb.cache_key = j.cache_key
      ORDER BY j.id DESC LIMIT 300
    `)
    .all() as JobListRow[];
}

export function translationMetrics() {
  const db = getDb();
  const totals = db
    .prepare(`
      SELECT COUNT(*) AS jobs,
             COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed,
             COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed,
             COUNT(CASE WHEN status IN ('QUEUED','PROCESSING') THEN 1 END) AS active,
             COALESCE(SUM(chars_translated), 0) AS chars,
             COALESCE(SUM(pages_translated), 0) AS pages,
             COALESCE(SUM(est_cost_usd), 0) AS cost,
             AVG(CASE WHEN status = 'COMPLETED' THEN duration_ms END) AS avg_ms
      FROM translation_jobs
    `)
    .get() as { jobs: number; completed: number | null; failed: number | null; active: number | null; chars: number; pages: number; cost: number; avg_ms: number | null };
  const byLanguage = db
    .prepare(`SELECT target_language AS lang, COUNT(*) AS n, COALESCE(SUM(chars_translated),0) AS chars, COALESCE(SUM(est_cost_usd),0) AS cost FROM translation_jobs GROUP BY target_language ORDER BY n DESC`)
    .all() as { lang: string; n: number; chars: number; cost: number }[];
  const byBook = db
    .prepare(`SELECT book_slug AS book, COUNT(*) AS n, COALESCE(SUM(est_cost_usd),0) AS cost FROM translation_jobs GROUP BY book_slug ORDER BY n DESC`)
    .all() as { book: string; n: number; cost: number }[];
  // How many paid ebooks were served by translations (most from the cache instead of a new translation).
  const reuse = db
    .prepare(`SELECT COUNT(*) AS paid_translated FROM order_items i JOIN orders o ON o.id = i.order_id
              WHERE o.payment_status = 'PAID' AND i.target_language != i.source_language AND i.cache_key IS NOT NULL`)
    .get() as { paid_translated: number };
  return { totals, byLanguage, byBook, reuse };
}

export function recentPayments(limit = 50) {
  return getDb()
    .prepare(`SELECT p.id, p.provider, p.provider_payment_id, p.amount, p.currency, p.status, p.created_at, o.ref, o.id AS order_id
              FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.id DESC LIMIT ?`)
    .all(limit) as { id: number; provider: string; provider_payment_id: string | null; amount: number; currency: string; status: string; created_at: string; ref: string; order_id: number }[];
}

export function recentDownloads(limit = 50) {
  return getDb()
    .prepare(`SELECT d.id, d.event, d.created_at, o.ref, o.id AS order_id, COALESCE(i.target_language, o.target_language) AS target_language, i.book_slug
              FROM download_logs d JOIN orders o ON o.id = d.order_id LEFT JOIN order_items i ON i.id = d.item_id ORDER BY d.id DESC LIMIT ?`)
    .all(limit) as { id: number; event: string; created_at: string; ref: string; order_id: number; target_language: string; book_slug: string | null }[];
}

export function listCustomers(limit = 100) {
  return getDb()
    .prepare(`SELECT c.id, c.name, c.email, c.created_at,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orders,
                     (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.payment_status = 'PAID') AS paid
              FROM customers c ORDER BY c.id DESC LIMIT ?`)
    .all(limit) as { id: number; name: string; email: string; created_at: string; orders: number; paid: number }[];
}

export function getTranslatedBook(id: number) {
  return getDb().prepare("SELECT * FROM translated_books WHERE id = ?").get(id) as
    | { id: number; cache_key: string; book_slug: string; target_language: string; storage_key: string; bytes: number }
    | undefined;
}

export function orderJob(cacheKey: string | null) {
  if (!cacheKey) return undefined;
  return getDb().prepare("SELECT id, status, phase, progress, attempts, last_error FROM translation_jobs WHERE cache_key = ?").get(cacheKey) as
    | { id: number; status: string; phase: string | null; progress: number; attempts: number; last_error: string | null }
    | undefined;
}

export function orderDownloads(orderId: number) {
  return getDb()
    .prepare(`SELECT d.event, d.created_at, i.book_title, i.target_language FROM download_logs d LEFT JOIN order_items i ON i.id = d.item_id
              WHERE d.order_id = ? ORDER BY d.id DESC LIMIT 30`)
    .all(orderId) as { event: string; created_at: string; book_title: string | null; target_language: string | null }[];
}

export type TranslationCell = { status: "COMPLETED" | "QUEUED" | "PROCESSING" | "FAILED"; translatedBookId: number | null; progress: number };

/**
 * Status of every book + language prepared so far, for the CURRENT version of each source PDF
 * (older versions are obsolete once the source PDF is replaced): Map<book_slug, Map<language, cell>>.
 */
export function translationMatrix(currentVersion: (bookSlug: string) => string | null): Map<string, Map<string, TranslationCell>> {
  const rows = getDb()
    .prepare(`
      SELECT j.book_slug, j.target_language, j.source_version, j.status, j.progress, tb.id AS tb_id
      FROM translation_jobs j LEFT JOIN translated_books tb ON tb.cache_key = j.cache_key
      UNION ALL
      SELECT tb.book_slug, tb.target_language, tb.source_version, 'COMPLETED', 100, tb.id
      FROM translated_books tb WHERE NOT EXISTS (SELECT 1 FROM translation_jobs j WHERE j.cache_key = tb.cache_key)
    `)
    .all() as { book_slug: string; target_language: string; source_version: string; status: TranslationCell["status"]; progress: number; tb_id: number | null }[];
  const out = new Map<string, Map<string, TranslationCell>>();
  for (const r of rows) {
    if (r.source_version !== currentVersion(r.book_slug)) continue;
    if (!out.has(r.book_slug)) out.set(r.book_slug, new Map());
    out.get(r.book_slug)!.set(r.target_language, { status: r.status, translatedBookId: r.tb_id, progress: r.progress });
  }
  return out;
}
