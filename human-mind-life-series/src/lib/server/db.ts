import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import type { DatabaseSync as SqliteDatabaseSync, SQLInputValue, StatementSync as SqliteStatementSync } from "node:sqlite";
import { ENV } from "@/config/env.server";
import { isSupportedNodeVersion } from "@/lib/runtime";

const requireFromFile = createRequire(import.meta.url);

type SqliteModule = typeof import("node:sqlite");

function getSqliteModule(): SqliteModule {
  if (ENV.database.driver === "supabase" && !!ENV.supabase.databaseUrl) {
    throw new Error("The SQLite compatibility layer is disabled while the Supabase database driver is active.");
  }

  try {
    return requireFromFile("node:sqlite") as SqliteModule;
  } catch {
    if (!isSupportedNodeVersion()) {
      throw new Error(
        "This project requires Node.js 24 or newer because it uses the built-in node:sqlite API. Switch to Node 24 with `nvm use 24` or `fnm use 24`, then run the app again.",
      );
    }

    throw new Error(
      "Unable to load the built-in node:sqlite module. Please use Node.js 24 or newer to run this project.",
    );
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePostgresSql(sql: string, params: unknown[], mode: "get" | "all" | "run" | "exec") {
  let text = sql.trim().replace(/;\s*$/, "");
  const bindValues: unknown[] = [];

  text = text.replace(/datetime\(['\"]now['\"]\)/gi, "NOW()");
  text = text.replace(/datetime\(['\"]now['\"],\s*'\+'\s*\|\|\s*(\?|@([A-Za-z_][A-Za-z0-9_]*)|:([A-Za-z_][A-Za-z0-9_]*))\s*\|\|\s*'\s*(hours|minutes|seconds)\s*'\)/gi, (_match, placeholder, named1, named2, unit) => {
    const token = placeholder ?? named1 ?? named2 ?? "?";
    return `(NOW() + (CAST(${token} AS integer) * INTERVAL '1 ${unit}'))`;
  });
  text = text.replace(/CASE\s+WHEN\s+(@[A-Za-z_][A-Za-z0-9_]*|:[A-Za-z_][A-Za-z0-9_]*|\?)\s+IS\s+NULL/gi, (_match, token) => {
    return `CASE WHEN CAST(${token} AS text) IS NULL`;
  });
  text = text.replace(/COLLATE\s+NOCASE/gi, "");
  text = text.replace(/MAX\(([^)]+),\s*([^)]+)\)/gi, "GREATEST($1, $2)");

  if (/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(text)) {
    text = text.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, "INSERT INTO");
    if (!/\bON\s+CONFLICT\b/i.test(text)) {
      text += " ON CONFLICT DO NOTHING";
    }
  }

  if (mode === "run" && /^\s*INSERT\b/i.test(text) && !/\bRETURNING\b/i.test(text)) {
    text += " RETURNING id";
  }

  if (params.length === 1 && isPlainObject(params[0])) {
    const object = params[0] as Record<string, unknown>;
    let index = 0;
    text = text.replace(/@([A-Za-z_][A-Za-z0-9_]*)|:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, named1, named2) => {
      index += 1;
      const key = named1 ?? named2 ?? "";
      bindValues.push(object[key]);
      return `$${index}`;
    });
    text = text.replace(/\?/g, () => {
      const indexValue = bindValues.length + 1;
      const next = Object.values(object)[indexValue - 1];
      bindValues.push(next);
      return `$${indexValue}`;
    });
  } else {
    let index = 0;
    text = text.replace(/\?/g, () => {
      index += 1;
      return `$${index}`;
    });
    bindValues.push(...params);
  }

  text = text.replace(/SELECT\s+value\s+FROM\s+json_each\(\$([0-9]+)\)/gi, (_, index) => `SELECT (jsonb_array_elements_text(CAST($${index} AS jsonb)))::bigint`);
  text = text.replace(/json_each\(\$([0-9]+)\)/gi, (_, index) => `jsonb_array_elements_text(CAST($${index} AS jsonb))`);


  return { text, values: bindValues };
}

class SupabaseWorkerPool {
  private worker: Worker | null = null;
  private sab: SharedArrayBuffer;
  private control: Int32Array;
  private dataView: Uint8Array;
  private dbUrl: string;

  constructor(dbUrl: string) {
    this.dbUrl = dbUrl;
    this.sab = new SharedArrayBuffer(16 * 1024 * 1024); // 16MB
    this.control = new Int32Array(this.sab, 0, 4);
    this.dataView = new Uint8Array(this.sab, 16);
    this.initWorker();
  }

  private initWorker() {
    try {
      const workerScript = `
        try { require("node:dns").setDefaultResultOrder("ipv4first"); } catch {}
        const { parentPort, workerData } = require("node:worker_threads");
        const sab = workerData.sab;
        const control = new Int32Array(sab, 0, 4);
        const dataView = new Uint8Array(sab, 16);

        let pool = null;
        function getPool() {
          if (!pool) {
            const { Pool } = require("pg");
            pool = new Pool({
              connectionString: workerData.dbUrl,
              ssl: { rejectUnauthorized: false },
              max: 10,
              idleTimeoutMillis: 60000,
              connectionTimeoutMillis: 10000,
            });
            pool.on("error", () => {});
          }
          return pool;
        }

        parentPort.on("message", async () => {
          try {
            const len = control[1];
            const raw = Buffer.from(dataView.buffer, 16, len).toString("utf8");
            const { text, values, mode } = JSON.parse(raw);

            const p = getPool();
            const result = await p.query(text, values || []);
            let output;
            if (mode === "run") {
              output = {
                lastInsertRowid: result.rows?.[0]?.id != null ? Number(result.rows[0].id) : null,
                changes: result.rowCount ?? 0,
              };
            } else if (mode === "get") {
              output = result.rows?.[0] ?? null;
            } else if (mode === "all") {
              output = result.rows ?? [];
            } else {
              output = { ok: true, rowCount: result.rowCount ?? 0 };
            }

            const out = JSON.stringify({ ok: true, data: output });
            const encoded = Buffer.from(out);
            if (encoded.length > dataView.length) {
              throw new Error("Result too large for worker buffer");
            }
            dataView.set(encoded);
            control[1] = encoded.length;
            control[0] = 2; // done
          } catch (err) {
            let msg = (err && err.message) || "Supabase query failed";
            if (msg.includes("ETIMEDOUT") && workerData.dbUrl && workerData.dbUrl.includes("db.")) {
              msg += " (Direct Supabase connections are IPv6-only. Use the Supabase Connection Pooler URL with port 6543/5432 for IPv4 compatibility).";
            }
            const out = JSON.stringify({ ok: false, message: msg });
            const encoded = Buffer.from(out);
            dataView.set(encoded);
            control[1] = encoded.length;
            control[0] = 3; // error
          } finally {
            Atomics.notify(control, 0, 1);
          }
        });
      `;

      this.worker = new Worker(workerScript, {
        eval: true,
        workerData: { sab: this.sab, dbUrl: this.dbUrl },
        env: process.env,
      });

      this.worker.on("error", () => {
        this.terminate();
      });

      this.worker.on("exit", () => {
        this.worker = null;
      });
    } catch {
      this.worker = null;
    }
  }

  private terminate() {
    try {
      this.worker?.terminate();
    } catch {}
    this.worker = null;
  }

  querySync(text: string, values: unknown[], mode: string): unknown {
    if (!this.worker) this.initWorker();
    if (!this.worker) throw new Error("Worker pool could not be initialized");

    const payload = JSON.stringify({ text, values, mode });
    const encoded = Buffer.from(payload);
    if (encoded.length > this.dataView.length) {
      throw new Error("Query payload too large");
    }

    this.dataView.set(encoded);
    this.control[1] = encoded.length;
    this.control[0] = 1; // working

    this.worker.postMessage("query");
    const waitRes = Atomics.wait(this.control, 0, 1, 30000);
    if (waitRes === "timed-out") {
      this.terminate();
      throw new Error("Supabase query timed out (30s)");
    }

    const len = this.control[1];
    const raw = Buffer.from(this.dataView.buffer, 16, len).toString("utf8");
    const res = JSON.parse(raw);
    if (!res.ok) throw new Error(res.message);
    return res.data;
  }
}

const globalWorkerPool = globalThis as unknown as { __supabaseWorkerPool?: SupabaseWorkerPool };

function getWorkerPool(): SupabaseWorkerPool | null {
  if (!ENV.supabase.databaseUrl) return null;
  if (!globalWorkerPool.__supabaseWorkerPool) {
    try {
      globalWorkerPool.__supabaseWorkerPool = new SupabaseWorkerPool(ENV.supabase.databaseUrl);
    } catch {
      return null;
    }
  }
  return globalWorkerPool.__supabaseWorkerPool;
}

function executeSupabaseQuerySpawn(text: string, values: unknown[], mode: "get" | "all" | "run" | "exec") {
  const script = `
    try { require("node:dns").setDefaultResultOrder("ipv4first"); } catch {}
    const { Client } = require("pg");
    const fs = require("node:fs");
    (async () => {
      const payload = JSON.parse(fs.readFileSync(0, "utf8"));
      const client = new Client({
        connectionString: process.env.SUPABASE_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
      });
      await client.connect();
      try {
        const result = await client.query(payload.text, payload.values ?? []);
        let output;
        if (payload.mode === "run") {
          output = {
            lastInsertRowid: result.rows?.[0]?.id != null ? Number(result.rows[0].id) : null,
            changes: result.rowCount ?? 0,
          };
        } else if (payload.mode === "get") {
          output = result.rows?.[0] ?? null;
        } else if (payload.mode === "all") {
          output = result.rows ?? [];
        } else {
          output = { ok: true, rowCount: result.rowCount ?? 0 };
        }
        process.stdout.write(JSON.stringify({ ok: true, data: output }));
      } finally {
        await client.end().catch(() => {});
      }
    })().catch((err) => {
      let msg = (err && err.message) || "Supabase query failed";
      if (msg.includes("ETIMEDOUT") && process.env.SUPABASE_DATABASE_URL && process.env.SUPABASE_DATABASE_URL.includes("db.")) {
        msg += " (Direct Supabase connections are IPv6-only. Use the Supabase Connection Pooler URL with port 6543/5432 for IPv4 compatibility).";
      }
      process.stdout.write(JSON.stringify({ ok: false, message: msg }));
      process.exitCode = 1;
    });
  `;

  const resolvedPgPath = (() => {
    try {
      return path.dirname(path.dirname(requireFromFile.resolve("pg")));
    } catch {
      return "";
    }
  })();
  const nodePath = [
    path.join(process.cwd(), "node_modules"),
    resolvedPgPath,
    process.env.NODE_PATH,
  ].filter(Boolean).join(path.delimiter);

  const child = spawnSync(process.execPath, ["-e", script], {
    cwd: process.cwd(),
    input: JSON.stringify({ text, values, mode }),
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 30000,
    env: { ...process.env, NODE_PATH: nodePath, SUPABASE_DATABASE_URL: ENV.supabase.databaseUrl },
  });

  if (child.error) throw child.error;
  if ((child.status ?? 0) !== 0) {
    throw new Error(child.stderr?.trim() || child.stdout?.trim() || "Supabase query failed.");
  }

  const output = JSON.parse(child.stdout || "{\"ok\":true,\"data\":null}");
  if (!output.ok) throw new Error(output.message || "Supabase query failed.");
  return output.data;
}

function executeSupabaseQuery(sql: string, params: unknown[], mode: "get" | "all" | "run" | "exec") {
  const { text, values } = normalizePostgresSql(sql, params, mode);

  try {
    const pool = getWorkerPool();
    if (pool) {
      return pool.querySync(text, values, mode);
    }
  } catch (err) {
    console.warn("[executeSupabaseQuery] Worker pool query failed, using spawn fallback:", err instanceof Error ? err.message : err);
  }

  return executeSupabaseQuerySpawn(text, values, mode);
}

/**
 * Default private storage folder for an app running in `cwd`: ./storage, except
 * on Hostinger Node.js hosting, which replaces …/domains/<domain>/hbuilds/ on
 * every deployment — there the data is kept beside it in …/domains/<domain>/storage.
 * A standalone build (node .next/standalone/server.js) uses the project's ./storage,
 * never a folder inside .next that the next build would wipe.
 */
export function defaultStorageDir(cwd: string): string {
  const hostinger = cwd.replace(/\\/g, "/").match(/^(.*\/domains\/[^/]+)\/hbuilds(\/|$)/);
  // turbopackIgnore: a runtime data folder — never trace (copy) its contents into the build output.
  if (hostinger) return path.join(/*turbopackIgnore: true*/ hostinger[1], "storage");
  return path.join(/*turbopackIgnore: true*/ cwd.replace(/[\\/]\.next[^\\/]*[\\/]standalone$/, ""), "storage");
}

/** True if `dir` is inside a folder that a deployment or build replaces (data there would be lost). */
export function isEphemeralDir(dir: string): boolean {
  return /\/(hbuilds|\.next[^/]*|public_html|public)(\/|$)/.test(dir.replace(/\\/g, "/"));
}

/** Where private data lives and whether it is usable — for the admin setup page and startup log. */
export function storageStatus(): { dir: string; writable: boolean; ephemeral: boolean; fromEnv: boolean } {
  let writable = true;
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    fs.accessSync(STORAGE_DIR, fs.constants.W_OK);
  } catch {
    writable = false;
  }
  return { dir: STORAGE_DIR, writable, ephemeral: isEphemeralDir(STORAGE_DIR), fromEnv: !!process.env.STORAGE_DIR };
}

/**
 * Private storage lives OUTSIDE the /public folder, so nothing in it can be
 * downloaded directly. Override the location with STORAGE_DIR in .env.local.
 */
export const STORAGE_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR || defaultStorageDir(process.cwd()));
export const SCREENSHOT_DIR = path.join(/*turbopackIgnore: true*/ STORAGE_DIR, "payment-screenshots");
export const PRIVATE_BOOKS_DIR = path.join(/*turbopackIgnore: true*/ STORAGE_DIR, "books");

/**
 * Node's built-in SQLite (node:sqlite) behind the small better-sqlite3-style API the app uses.
 * Built in, so deploying needs no native module compiled with Python / node-gyp.
 */
class Statement {
  constructor(private readonly stmt: SqliteStatementSync | null, private readonly sql: string | null, private readonly db: Database | null) {
    if (this.stmt) {
      this.stmt.setAllowUnknownNamedParameters(true);
    }
  }

  run(...params: unknown[]) {
    if (this.db && this.db.isSupabaseMode()) {
      return executeSupabaseQuery(this.sql ?? "", params, "run");
    }
    return (this.stmt as SqliteStatementSync).run(...(params as SQLInputValue[]));
  }

  get(...params: unknown[]): unknown {
    if (this.db && this.db.isSupabaseMode()) {
      return executeSupabaseQuery(this.sql ?? "", params, "get");
    }
    const row = (this.stmt as SqliteStatementSync).get(...(params as SQLInputValue[]));
    return row && { ...row };
  }

  all(...params: unknown[]): unknown[] {
    if (this.db && this.db.isSupabaseMode()) {
      return executeSupabaseQuery(this.sql ?? "", params, "all") as unknown[];
    }
    return (this.stmt as SqliteStatementSync).all(...(params as SQLInputValue[])).map((row) => ({ ...row }));
  }
}

export class Database {
  private readonly db?: SqliteDatabaseSync;
  private depth = 0;

  constructor(file?: string) {
    if (ENV.database.driver !== "supabase" || !ENV.supabase.databaseUrl) {
      const sqlite = getSqliteModule();
      this.db = new sqlite.DatabaseSync(file ?? path.join(STORAGE_DIR, "orders.db"));
    }
  }

  isSupabaseMode(): boolean {
    return ENV.database.driver === "supabase" && !!ENV.supabase.databaseUrl;
  }

  prepare(sql: string): Statement {
    if (this.isSupabaseMode()) return new Statement(null, sql, this);
    return new Statement(this.db!.prepare(sql), sql, null);
  }

  exec(sql: string): void {
    if (this.isSupabaseMode()) {
      executeSupabaseQuery(sql, [], "exec");
      return;
    }
    this.db!.exec(sql);
  }

  /** Wraps `fn` in BEGIN … COMMIT (a savepoint when nested); rolls back and rethrows if it throws. */
  transaction<T>(fn: () => T): () => T {
    if (this.isSupabaseMode()) {
      return () => fn();
    }

    return () => {
      const savepoint = this.depth > 0 ? `sp${this.depth}` : null;
      this.db!.exec(savepoint ? `SAVEPOINT ${savepoint}` : "BEGIN");
      this.depth++;
      try {
        const result = fn();
        this.db!.exec(savepoint ? `RELEASE ${savepoint}` : "COMMIT");
        return result;
      } catch (err) {
        if (this.db!.isTransaction) this.db!.exec(savepoint ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : "ROLLBACK");
        throw err;
      } finally {
        this.depth--;
      }
    };
  }

  /** Online backup to `file`: a consistent snapshot that includes changes still in the -wal file. */
  async backup(file: string): Promise<void> {
    if (this.isSupabaseMode()) {
      const script = `
        const { execFileSync } = require("node:child_process");
        const url = process.env.SUPABASE_DATABASE_URL;
        if (!url) process.exit(1);
        execFileSync("pg_dump", [url, "--file", ${JSON.stringify(file)}, "--clean", "--if-exists"], { stdio: "inherit" });
      `;
      spawnSync(process.execPath, ["-e", script], { env: { ...process.env, SUPABASE_DATABASE_URL: ENV.supabase.databaseUrl }, encoding: "utf8" });
      return;
    }
    const sqlite = getSqliteModule();
    await sqlite.backup(this.db!, file);
  }

  close(): void {
    if (this.db) this.db.close();
  }
}

const globalForDb = globalThis as unknown as { __hmDb?: Database };

function open(): Database {
  if (ENV.database.driver === "supabase" && !!ENV.supabase.databaseUrl) {
    return new Database();
  }

  for (const dir of [STORAGE_DIR, SCREENSHOT_DIR, PRIVATE_BOOKS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(path.join(/*turbopackIgnore: true*/ STORAGE_DIR, "orders.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
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
function migrate(db: Database) {
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
  // ---- Packages (v4): individual / 3-book / 5-book bundle (src/config/packages.ts) ----
  add("package_type", "package_type TEXT NOT NULL DEFAULT 'individual'");

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

    -- One row per ebook in an order (1, 3 or 5), each with its OWN language, delivery state, file and downloads.
    CREATE TABLE IF NOT EXISTS order_items (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      position           INTEGER NOT NULL DEFAULT 0,
      book_slug          TEXT    NOT NULL,
      book_title         TEXT    NOT NULL,
      author             TEXT,
      source_language    TEXT    NOT NULL DEFAULT 'en',
      target_language    TEXT    NOT NULL,
      fulfillment_status TEXT    NOT NULL DEFAULT 'NOT_STARTED'
                         CHECK (fulfillment_status IN ('NOT_STARTED','PROCESSING','COMPLETED','FAILED')),
      cache_key          TEXT,
      translated_book_id INTEGER,
      download_count     INTEGER NOT NULL DEFAULT 0,
      access_expires_at  TEXT,
      created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE (order_id, book_slug)
    );
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_items_cache_key ON order_items(cache_key);

    -- Orders placed before packages had exactly one book: copy it into order_items (once).
    INSERT INTO order_items (order_id, position, book_slug, book_title, author, source_language, target_language,
                             fulfillment_status, cache_key, translated_book_id, download_count, access_expires_at, created_at, updated_at)
    SELECT o.id, 0, o.product_slug, o.product_title, o.author, o.source_language, o.target_language,
           o.fulfillment_status, o.cache_key, o.translated_book_id, o.download_count, o.access_expires_at, o.created_at, o.updated_at
    FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id);
    UPDATE orders SET package_type = 'five_book_bundle' WHERE product_slug = 'complete-series' AND package_type = 'individual';
  `);

  const logCols = new Set((db.prepare("PRAGMA table_info(download_logs)").all() as { name: string }[]).map((c) => c.name));
  if (!logCols.has("item_id")) db.exec("ALTER TABLE download_logs ADD COLUMN item_id INTEGER");
}

export function getDb(): Database {
  if (!globalForDb.__hmDb) globalForDb.__hmDb = open();
  return globalForDb.__hmDb;
}
