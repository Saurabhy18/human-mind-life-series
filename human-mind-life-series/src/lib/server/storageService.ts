import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "@/config/env.server";
import { STORAGE_DIR } from "./db";

/**
 * Private storage for generated (translated) books. Nothing here is ever
 * publicly addressable: files are reached only through short-lived signed
 * URLs issued after payment + authorization checks.
 *
 *  - local: files under STORAGE_DIR/files, URLs signed with HMAC (served by /api/files).
 *  - gcs:   a PRIVATE Google Cloud Storage bucket (BOOK_STORAGE_BUCKET), V4 signed URLs.
 */
export interface StorageService {
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  exists(key: string): Promise<boolean>;
  signedUrl(key: string, opts: { ttlSeconds: number; downloadName: string }): Promise<string>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;
function checkKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

export const FILES_DIR = path.join(STORAGE_DIR, "files");

function sign(payload: string): string {
  const secret = ENV.download.signingSecret;
  if (!secret || secret.length < 32) throw new Error("DOWNLOAD_SIGNING_SECRET (or SESSION_SECRET) must be set to at least 32 characters");
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Verifies a local signed URL. Returns the storage key and download name if valid and not expired. */
export function verifyLocalSignature(params: URLSearchParams, key: string): { ok: true; name: string } | { ok: false; reason: "expired" | "invalid" } {
  const exp = Number(params.get("exp"));
  const name = params.get("name") ?? "book.pdf";
  const sig = params.get("sig") ?? "";
  if (!Number.isFinite(exp) || !sig) return { ok: false, reason: "invalid" };
  const expected = sign(`${key}\n${exp}\n${name}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  if (Date.now() / 1000 > exp) return { ok: false, reason: "expired" };
  return { ok: true, name };
}

class LocalStorage implements StorageService {
  private file(key: string) {
    checkKey(key);
    return path.join(FILES_DIR, ...key.split("/"));
  }
  async put(key: string, data: Uint8Array) {
    const f = this.file(key);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const tmp = `${f}.tmp-${process.pid}`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, f); // atomic: readers never see a half-written book
  }
  async get(key: string) {
    return new Uint8Array(fs.readFileSync(this.file(key)));
  }
  async exists(key: string) {
    return fs.existsSync(this.file(key));
  }
  async signedUrl(key: string, { ttlSeconds, downloadName }: { ttlSeconds: number; downloadName: string }) {
    checkKey(key);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = sign(`${key}\n${exp}\n${downloadName}`);
    const q = new URLSearchParams({ exp: String(exp), name: downloadName, sig });
    return `/api/files/${key}?${q.toString()}`;
  }
}

/** The few @google-cloud/storage methods we use (declared locally to keep type-checking light). */
type GcsFile = {
  save(data: Buffer, opts: { contentType: string; resumable: boolean; private: boolean }): Promise<unknown>;
  download(): Promise<[Buffer]>;
  exists(): Promise<[boolean]>;
  getSignedUrl(opts: { version: "v4"; action: "read"; expires: number; responseDisposition: string; responseType: string }): Promise<[string]>;
};
type GcsBucket = { file(name: string): GcsFile };

class GcsStorage implements StorageService {
  private bucketPromise: Promise<GcsBucket> | null = null;
  private bucket() {
    if (!this.bucketPromise) {
      this.bucketPromise = (import(/* webpackIgnore: true */ "@google-cloud/storage" as string) as Promise<{ Storage: new () => { bucket(name: string): GcsBucket } }>).then(
        ({ Storage }) => new Storage().bucket(ENV.storage.bucket),
      );
    }
    return this.bucketPromise;
  }
  async put(key: string, data: Uint8Array, contentType: string) {
    checkKey(key);
    await (await this.bucket()).file(key).save(Buffer.from(data), { contentType, resumable: false, private: true });
  }
  async get(key: string) {
    checkKey(key);
    const [buf] = await (await this.bucket()).file(key).download();
    return new Uint8Array(buf);
  }
  async exists(key: string) {
    checkKey(key);
    const [ok] = await (await this.bucket()).file(key).exists();
    return ok;
  }
  async signedUrl(key: string, { ttlSeconds, downloadName }: { ttlSeconds: number; downloadName: string }) {
    checkKey(key);
    const [url] = await (await this.bucket()).file(key).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + ttlSeconds * 1000,
      responseDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
      responseType: "application/pdf",
    });
    return url;
  }
}

let instance: StorageService | null = null;
export function getStorage(): StorageService {
  if (!instance) instance = ENV.storage.driver === "gcs" ? new GcsStorage() : new LocalStorage();
  return instance;
}
