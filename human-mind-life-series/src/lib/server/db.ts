import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * Private storage lives OUTSIDE the /public folder, so nothing in it can be
 * downloaded directly. Override the location with STORAGE_DIR in .env.local.
 */
export const STORAGE_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
export const SCREENSHOT_DIR = path.join(STORAGE_DIR, "payment-screenshots");
export const PRIVATE_BOOKS_DIR = path.join(STORAGE_DIR, "books");

const globalForDb = globalThis as unknown as { __hmDb?: Database.Database };

function open(): Database.Database {
  for (const dir of [STORAGE_DIR, SCREENSHOT_DIR, PRIVATE_BOOKS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path.join(STORAGE_DIR, "orders.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      ref             TEXT    NOT NULL UNIQUE,
      product_slug    TEXT    NOT NULL,
      product_title   TEXT    NOT NULL,
      amount          INTEGER NOT NULL,
      amount_paid     REAL,
      author          TEXT,
      buyer_name      TEXT    NOT NULL,
      email           TEXT    NOT NULL,
      whatsapp        TEXT    NOT NULL,
      utr             TEXT    NOT NULL UNIQUE,
      screenshot_file TEXT    NOT NULL,
      screenshot_mime TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','verified','rejected','delivered')),
      admin_note      TEXT,
      utm_json        TEXT,
      ip_hash         TEXT,
      user_agent      TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      verified_at     TEXT,
      delivered_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

    CREATE TABLE IF NOT EXISTS order_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status     TEXT    NOT NULL,
      note       TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      phone      TEXT,
      topic      TEXT    NOT NULL,
      message    TEXT    NOT NULL,
      handled    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Free-book requests (e.g. Volume 6). Kept completely separate from paid orders.
    CREATE TABLE IF NOT EXISTS free_requests (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      ref                 TEXT    NOT NULL UNIQUE,
      book_slug           TEXT    NOT NULL,
      book_title          TEXT    NOT NULL,
      author              TEXT,
      name                TEXT    NOT NULL,
      email               TEXT    NOT NULL,
      whatsapp            TEXT,
      status              TEXT    NOT NULL DEFAULT 'received'
                          CHECK (status IN ('received','sent','completed')),
      admin_note          TEXT,
      download_token_hash TEXT    UNIQUE,
      download_expires_at TEXT,
      download_count      INTEGER NOT NULL DEFAULT 0,
      utm_json            TEXT,
      ip_hash             TEXT,
      user_agent          TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
      sent_at             TEXT,
      completed_at        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_free_status  ON free_requests(status);
    CREATE INDEX IF NOT EXISTS idx_free_created ON free_requests(created_at);
  `);
  migrate(db);
  return db;
}

/** Adds columns introduced after the first release to existing databases. */
function migrate(db: Database.Database) {
  const cols = new Set((db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("amount_paid")) db.exec("ALTER TABLE orders ADD COLUMN amount_paid REAL");
  if (!cols.has("author")) db.exec("ALTER TABLE orders ADD COLUMN author TEXT");

  // ---- Multilingual delivery (v3) ----------------------------------------
  const add = (name: string, ddl: string) => {
    if (!cols.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${ddl}`);
  };
  add("source_language", "source_language TEXT NOT NULL DEFAULT 'en'");
  add("target_language", "target_language TEXT NOT NULL DEFAULT 'en'");
  add("currency", "currency TEXT NOT NULL DEFAULT 'INR'");
  add("customer_id", "customer_id INTEGER");
  // Payment truth comes ONLY from admin verification (UPI) or a verified gateway webhook — never the browser.
  add("payment_status", "payment_status TEXT NOT NULL DEFAULT 'PENDING'");
  add("payment_provider", "payment_provider TEXT NOT NULL DEFAULT 'manual_upi'");
  add("provider_order_id", "provider_order_id TEXT");
  add("paid_at", "paid_at TEXT");
  add("fulfillment_status", "fulfillment_status TEXT NOT NULL DEFAULT 'NOT_STARTED'");
  add("cache_key", "cache_key TEXT");
  add("translated_book_id", "translated_book_id INTEGER");
  add("access_expires_at", "access_expires_at TEXT");
  add("download_count", "download_count INTEGER NOT NULL DEFAULT 0");
  add("ready_email_sent_at", "ready_email_sent_at TEXT");
  add("processing_email_sent_at", "processing_email_sent_at TEXT");

  // Orders created before this release used the manual UPI flow; keep their payment status in step with the admin status.
  db.exec(`UPDATE orders SET payment_status = 'PAID' WHERE payment_status = 'PENDING' AND status IN ('verified','delivered')`);
  db.exec(`UPDATE orders SET payment_status = 'FAILED' WHERE payment_status = 'PENDING' AND status = 'rejected'`);

  // UPI orders have no gateway order id; gateway orders need a unique one.
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_order ON orders(payment_provider, provider_order_id) WHERE provider_order_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_orders_cache_key ON orders(cache_key);

    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      whatsapp   TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- One row per verified payment event. The UNIQUE key makes webhook processing idempotent.
    CREATE TABLE IF NOT EXISTS payments (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id            INTEGER NOT NULL REFERENCES orders(id),
      provider            TEXT    NOT NULL,
      idempotency_key     TEXT    NOT NULL UNIQUE,
      provider_payment_id TEXT,
      provider_order_id   TEXT,
      amount              REAL    NOT NULL,
      currency            TEXT    NOT NULL,
      status              TEXT    NOT NULL,
      raw_event           TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

    -- One job per cache key (book + source + target + source version): never translated twice.
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key         TEXT    NOT NULL UNIQUE,
      book_slug         TEXT    NOT NULL,
      source_language   TEXT    NOT NULL,
      target_language   TEXT    NOT NULL,
      source_version    TEXT    NOT NULL,
      strategy          TEXT    NOT NULL,
      status            TEXT    NOT NULL DEFAULT 'QUEUED'
                        CHECK (status IN ('NOT_STARTED','QUEUED','PROCESSING','COMPLETED','FAILED')),
      phase             TEXT,
      progress          INTEGER NOT NULL DEFAULT 0,
      attempts          INTEGER NOT NULL DEFAULT 0,
      next_attempt_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      locked_until      TEXT,
      last_error        TEXT,
      chars_translated  INTEGER NOT NULL DEFAULT 0,
      pages_translated  INTEGER NOT NULL DEFAULT 0,
      est_cost_usd      REAL    NOT NULL DEFAULT 0,
      started_at        TEXT,
      finished_at       TEXT,
      duration_ms       INTEGER,
      created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON translation_jobs(status, next_attempt_at);

    CREATE TABLE IF NOT EXISTS translated_books (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key       TEXT    NOT NULL UNIQUE,
      book_slug       TEXT    NOT NULL,
      source_language TEXT    NOT NULL,
      target_language TEXT    NOT NULL,
      source_version  TEXT    NOT NULL,
      storage_key     TEXT    NOT NULL,
      bytes           INTEGER NOT NULL,
      sha256          TEXT    NOT NULL,
      job_id          INTEGER REFERENCES translation_jobs(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Bearer tokens that let a customer see THEIR order's status and downloads. Only SHA-256 hashes are stored.
    CREATE TABLE IF NOT EXISTS order_access_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      token_hash TEXT    NOT NULL UNIQUE,
      purpose    TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_order ON order_access_tokens(order_id);

    CREATE TABLE IF NOT EXISTS download_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id   INTEGER NOT NULL REFERENCES orders(id),
      event      TEXT    NOT NULL,
      ip_hash    TEXT,
      user_agent TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_downloads_order ON download_logs(order_id);
  `);
}

export function getDb(): Database.Database {
  if (!globalForDb.__hmDb) globalForDb.__hmDb = open();
  return globalForDb.__hmDb;
}
