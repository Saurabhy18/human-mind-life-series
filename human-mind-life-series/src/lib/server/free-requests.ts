import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";
import type { FreeStatus } from "@/lib/free-status";

export type FreeRequest = {
  id: number;
  ref: string;
  book_slug: string;
  book_title: string;
  author: string | null;
  name: string;
  email: string;
  whatsapp: string | null;
  status: FreeStatus;
  admin_note: string | null;
  download_token_hash: string | null;
  download_expires_at: string | null;
  download_count: number;
  utm_json: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  completed_at: string | null;
};

export type NewFreeRequest = Pick<FreeRequest, "book_slug" | "book_title" | "author" | "name" | "email" | "whatsapp" | "utm_json" | "ip_hash" | "user_agent">;

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateRef(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return `FB-${out}`;
}

/** Only the SHA-256 of a download token is stored, so a database leak does not leak working links. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Saves a free-book request. When `linkHours` is given, also creates a private
 * one-person download token and returns it (the raw token is never stored).
 */
export function createFreeRequest(data: NewFreeRequest, linkHours: number | null): { id: number; ref: string; token: string | null } {
  const db = getDb();
  const token = linkHours ? crypto.randomBytes(32).toString("base64url") : null;
  const insert = db.prepare(`
    INSERT INTO free_requests (ref, book_slug, book_title, author, name, email, whatsapp, utm_json, ip_hash, user_agent,
                               download_token_hash, download_expires_at)
    VALUES (@ref, @book_slug, @book_title, @author, @name, @email, @whatsapp, @utm_json, @ip_hash, @user_agent,
            @token_hash, CASE WHEN @hours IS NULL THEN NULL ELSE datetime('now', '+' || @hours || ' hours') END)
  `);
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateRef();
    try {
      const res = insert.run({ ...data, ref, token_hash: token ? hashToken(token) : null, hours: linkHours });
      return { id: Number(res.lastInsertRowid), ref, token };
    } catch (err) {
      if (err instanceof Error && err.message.includes("free_requests.ref")) continue;
      throw err;
    }
  }
  throw new Error("Could not generate a unique request reference");
}

/**
 * Uses one download from a personal link. Returns the request if the token is
 * valid, not expired and under the download limit; otherwise null.
 * The first successful download marks the request as "Free Book Sent".
 */
export function consumeDownloadToken(token: string, limit: number): FreeRequest | null {
  const db = getDb();
  const hash = hashToken(token);
  return db.transaction(() => {
    const res = db
      .prepare(`
        UPDATE free_requests SET
          download_count = download_count + 1,
          status     = CASE WHEN status = 'received' THEN 'sent' ELSE status END,
          sent_at    = COALESCE(sent_at, datetime('now')),
          updated_at = datetime('now')
        WHERE download_token_hash = ? AND download_expires_at > datetime('now') AND download_count < ?
      `)
      .run(hash, limit);
    if (res.changes !== 1) return null;
    return db.prepare("SELECT * FROM free_requests WHERE download_token_hash = ?").get(hash) as FreeRequest;
  })();
}

/** Gives a used download back (e.g. when the PDF file could not be read). */
export function refundDownload(id: number): void {
  getDb().prepare("UPDATE free_requests SET download_count = MAX(download_count - 1, 0) WHERE id = ?").run(id);
}

export type FreeFilter = { status?: FreeStatus; q?: string };

export function listFreeRequests(filter: FreeFilter = {}): FreeRequest[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  if (filter.status) {
    where.push("status = @status");
    params.status = filter.status;
  }
  if (filter.q) {
    where.push("(name LIKE @q OR email LIKE @q OR whatsapp LIKE @q OR ref LIKE @q)");
    params.q = `%${filter.q}%`;
  }
  const sql = `SELECT * FROM free_requests ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 500`;
  return getDb().prepare(sql).all(params) as FreeRequest[];
}

export function countFreeByStatus(): Record<FreeStatus | "all", number> {
  const rows = getDb().prepare("SELECT status, COUNT(*) AS n FROM free_requests GROUP BY status").all() as { status: FreeStatus; n: number }[];
  const counts = { all: 0, received: 0, sent: 0, completed: 0 };
  for (const r of rows) {
    counts[r.status] = r.n;
    counts.all += r.n;
  }
  return counts;
}

export function getFreeRequest(id: number): FreeRequest | undefined {
  return getDb().prepare("SELECT * FROM free_requests WHERE id = ?").get(id) as FreeRequest | undefined;
}

export function updateFreeStatus(id: number, status: FreeStatus, note: string | null): void {
  getDb()
    .prepare(`
      UPDATE free_requests SET
        status = @status,
        admin_note = COALESCE(@note, admin_note),
        updated_at = datetime('now'),
        sent_at      = CASE WHEN @status IN ('sent','completed') AND sent_at IS NULL THEN datetime('now') ELSE sent_at END,
        completed_at = CASE WHEN @status = 'completed' AND completed_at IS NULL THEN datetime('now') ELSE completed_at END
      WHERE id = @id
    `)
    .run({ id, status, note });
}
