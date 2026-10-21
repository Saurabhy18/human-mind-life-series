import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { ENV } from "@/config/env.server";

const requireFromFile = createRequire(import.meta.url);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePostgresSql(sql: string, params: unknown[], mode: "get" | "all" | "run" | "exec") {
  let text = sql.trim().replace(/;\s*$/, "");
  const bindValues: unknown[] = [];

  text = text.replace(/datetime\(['"]now['"]\)/gi, "NOW()");
  text = text.replace(/datetime\(['"]now['"],\s*'\+'\s*\|\|\s*(\?|@([A-Za-z_][A-Za-z0-9_]*)|:([A-Za-z_][A-Za-z0-9_]*))\s*\|\|\s*'\s*(hours|minutes|seconds)\s*'\)/gi, (_match, placeholder, named1, named2, unit) => {
    const token = placeholder ?? named1 ?? named2 ?? "?";
    return `(NOW() + (CAST(${token} AS integer) * INTERVAL '1 ${unit}'))`;
  });
  text = text.replace(/CASE\s+WHEN\s+(@[A-Za-z_][A-Za-z0-9_]*|:[A-Za-z_][A-Za-z0-9_]*|\?)\s+IS\s+NULL/gi, (_match, token) => {
    return `CASE WHEN CAST(${token} AS text) IS NULL`;
  });
  text = text.replace(/LOWER\(\s*(@[A-Za-z_][A-Za-z0-9_]*|:[A-Za-z_][A-Za-z0-9_]*|\?)\s*\)/gi, (_match, token) => {
    return `LOWER(CAST(${token} AS text))`;
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
      const pgPath = requireFromFile.resolve("pg");
      const workerScript = `
        try { require("node:dns").setDefaultResultOrder("ipv4first"); } catch {}
        const { parentPort, workerData } = require("node:worker_threads");
        const sab = workerData.sab;
        const control = new Int32Array(sab, 0, 4);
        const dataView = new Uint8Array(sab, 16);

        const { Pool } = require(workerData.pgPath);
        const pool = new Pool({
          connectionString: workerData.dbUrl,
          ssl: { rejectUnauthorized: false },
          max: 2,
          idleTimeoutMillis: 10000,
          connectionTimeoutMillis: 10000,
        });
        pool.on("error", () => {});

        parentPort.on("message", async () => {
          try {
            const len = control[1];
            const raw = Buffer.from(dataView.buffer, 16, len).toString("utf8");
            const { text, values, mode } = JSON.parse(raw);

            const result = await pool.query(text, values || []);
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
        workerData: { sab: this.sab, dbUrl: this.dbUrl, pgPath },
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

  terminate() {
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
    const waitRes = Atomics.wait(this.control, 0, 1, 15000);
    if (waitRes === "timed-out") {
      this.terminate();
      throw new Error("Supabase query timed out (15s)");
    }

    const len = this.control[1];
    const raw = Buffer.from(this.dataView.buffer, 16, len).toString("utf8");
    const res = JSON.parse(raw);
    if (!res.ok) throw new Error(res.message);
    return res.data;
  }
}

const globalWorkerPool = globalThis as unknown as { __supabaseWorkerPool?: SupabaseWorkerPool };

function getWorkerPool(): SupabaseWorkerPool {
  const dbUrl = ENV.supabase.databaseUrl || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) throw new Error("SUPABASE_DATABASE_URL is not configured.");
  if (!globalWorkerPool.__supabaseWorkerPool) {
    globalWorkerPool.__supabaseWorkerPool = new SupabaseWorkerPool(dbUrl);
  }
  return globalWorkerPool.__supabaseWorkerPool;
}

function executeSupabaseQuery(sql: string, params: unknown[], mode: "get" | "all" | "run" | "exec") {
  const { text, values } = normalizePostgresSql(sql, params, mode);
  const pool = getWorkerPool();
  return pool.querySync(text, values, mode);
}

export function defaultStorageDir(cwd: string): string {
  const hostinger = cwd.replace(/\\/g, "/").match(/^(.*\/domains\/[^/]+)\/hbuilds(\/|$)/);
  if (hostinger) return path.join(hostinger[1], "storage");
  return path.join(cwd.replace(/[\\/]\.next[^\\/]*[\\/]standalone$/, ""), "storage");
}

export function isEphemeralDir(dir: string): boolean {
  return /\/(hbuilds|\.next[^/]*|public_html|public)(\/|$)/.test(dir.replace(/\\/g, "/"));
}

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || defaultStorageDir(process.cwd()));
export const SCREENSHOT_DIR = path.join(STORAGE_DIR, "payment-screenshots");
export const PRIVATE_BOOKS_DIR = path.join(STORAGE_DIR, "books");

export function storageStatus(): { dir: string; writable: boolean; ephemeral: boolean; fromEnv: boolean } {
  let writable = true;
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    fs.accessSync(STORAGE_DIR, fs.constants.W_OK);
  } catch {
    writable = false;
  }
  return {
    dir: STORAGE_DIR,
    writable,
    ephemeral: isEphemeralDir(STORAGE_DIR),
    fromEnv: !!process.env.STORAGE_DIR,
  };
}

export class Statement {
  constructor(private readonly sql: string) {}

  run(...params: unknown[]) {
    return executeSupabaseQuery(this.sql, params, "run") as { lastInsertRowid: number | null; changes: number };
  }

  get(...params: unknown[]): unknown {
    return executeSupabaseQuery(this.sql, params, "get");
  }

  all(...params: unknown[]): unknown[] {
    return executeSupabaseQuery(this.sql, params, "all") as unknown[];
  }
}

export class Database {
  prepare(sql: string): Statement {
    return new Statement(sql);
  }

  exec(sql: string): void {
    executeSupabaseQuery(sql, [], "exec");
  }

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ((...args: unknown[]) => {
      this.exec("BEGIN");
      try {
        const result = fn(...args);
        this.exec("COMMIT");
        return result;
      } catch (err) {
        this.exec("ROLLBACK");
        throw err;
      }
    }) as T;
  }

  async backup(file: string): Promise<void> {
    const tables = ["orders", "order_items", "order_events", "messages", "free_requests", "customers", "payments", "books"];
    const snapshot: Record<string, unknown[]> = {};
    for (const t of tables) {
      try {
        snapshot[t] = this.prepare(`SELECT * FROM ${t}`).all();
      } catch {
        snapshot[t] = [];
      }
    }
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
  }

  close(): void {
    globalWorkerPool.__supabaseWorkerPool?.terminate();
    globalWorkerPool.__supabaseWorkerPool = undefined;
  }
}

const globalForDb = globalThis as unknown as { __hmDb?: Database };

export function getDb(): Database {
  if (!globalForDb.__hmDb) {
    globalForDb.__hmDb = new Database();
  }
  return globalForDb.__hmDb;
}
