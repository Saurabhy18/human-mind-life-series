import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PRIVATE_BOOKS_DIR } from "../db";
import { getBook, type Book } from "@/lib/products";
import { getDbBookBySlug } from "../books";
import { ENV } from "@/config/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type BookSource = {
  slug: string;
  sourceLanguage: string;
  /** Private file path — never sent to the browser. */
  filePath: string;
  /** Automatic version: changes whenever the source PDF changes, which invalidates old translations. */
  version: string;
  bytes: number;
};

const versionCache = new Map<string, { mtimeMs: number; size: number; version: string }>();
const resolvedPaths = new Map<string, string>();
const inFlightSync = new Map<string, Promise<string | null>>();
const sourceCache = new Map<string, { at: number; source: BookSource | null }>();

function findExistingLocalPath(slug: string): string | null {
  const registered = resolvedPaths.get(slug);
  if (registered) {
    try {
      const s = fs.statSync(registered);
      if (s.isFile() && s.size > 0) return registered;
    } catch {
      resolvedPaths.delete(slug);
    }
  }

  const primary = path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${slug}.pdf`);
  try {
    const s = fs.statSync(primary);
    if (s.isFile() && s.size > 0) {
      resolvedPaths.set(slug, primary);
      return primary;
    }
  } catch {
    // primary not found
  }

  const fallback = path.join(os.tmpdir(), "books", `${slug}.pdf`);
  try {
    const s = fs.statSync(fallback);
    if (s.isFile() && s.size > 0) {
      resolvedPaths.set(slug, fallback);
      return fallback;
    }
  } catch {
    // fallback not found
  }

  return null;
}

const failedSyncs = new Map<string, number>();
const FAILED_SYNC_TTL = 300_000; // 5 minutes cache for failed downloads

export function clearBookSourceCache(slug?: string) {
  if (slug) {
    sourceCache.delete(slug);
    failedSyncs.delete(slug);
    resolvedPaths.delete(slug);
  } else {
    failedSyncs.clear();
    resolvedPaths.clear();
    sourceCache.clear();
  }
}

/**
 * Lightweight check to know whether a book source PDF is present locally or configured in database/storage.
 * Does NOT download entire PDF files over the network during page renders.
 */
export function isBookSourceAvailable(slugOrBook: string | Book): boolean {
  const slug = typeof slugOrBook === "string" ? slugOrBook : slugOrBook.slug;
  if (!slug) return false;

  // 1. Check local filesystem
  if (findExistingLocalPath(slug)) return true;

  // 2. Check cached source
  const cached = sourceCache.get(slug);
  if (cached?.source) return true;

  // 3. Check database record
  try {
    const dbBook = getDbBookBySlug(slug);
    if (dbBook?.pdf_filename) return true;
  } catch {}

  return false;
}

/**
 * Ensures the source PDF is present on the local filesystem.
 * If not present locally and Supabase storage is configured, downloads
 * the PDF from the Supabase bucket and caches it locally.
 */
export async function ensureBookSource(slugOrBook: string | Book): Promise<string | null> {
  const slug = typeof slugOrBook === "string" ? slugOrBook : slugOrBook.slug;
  if (!slug) return null;

  const existing = findExistingLocalPath(slug);
  if (existing) return existing;

  if (failedSyncs.has(slug) && Date.now() - failedSyncs.get(slug)! < FAILED_SYNC_TTL) {
    return null;
  }

  const isSupabase = ENV.storage.driver === "supabase" || (ENV.supabase.ready && !!ENV.storage.bucket);
  if (!isSupabase) return null;

  if (inFlightSync.has(slug)) {
    return inFlightSync.get(slug)!;
  }

  const syncPromise = (async () => {
    try {
      const client = createSupabaseAdminClient();
      if (!client) return null;
      const bucket = ENV.storage.bucket || "site-files";

      const dbBook = getDbBookBySlug(slug);
      const pdfFilename = dbBook?.pdf_filename || `${slug}.pdf`;

      // 1. Check database pdfFilename
      let res = await client.storage.from(bucket).download(pdfFilename);
      // 2. Check root `${slug}.pdf`
      if (res.error || !res.data) {
        res = await client.storage.from(bucket).download(`${slug}.pdf`);
      }
      // 3. Fallback to `books/${slug}.pdf`
      if (res.error || !res.data) {
        res = await client.storage.from(bucket).download(`books/${slug}.pdf`);
      }

      if (res.error || !res.data) {
        failedSyncs.set(slug, Date.now());
        return null;
      }

      const buffer = Buffer.from(await res.data.arrayBuffer());

      // Attempt to save to PRIVATE_BOOKS_DIR first, fallback to os.tmpdir()/books
      let targetPath = path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, pdfFilename);
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        const tmp = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, targetPath);
      } catch {
        targetPath = path.join(os.tmpdir(), "books", pdfFilename);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        const tmp = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, targetPath);
      }

      failedSyncs.delete(slug);
      resolvedPaths.set(slug, targetPath);
      sourceCache.delete(slug);
      return targetPath;
    } catch (err) {
      failedSyncs.set(slug, Date.now());
      console.error(`[bookSource] Failed to download ${slug}.pdf from Supabase storage:`, err);
      return null;
    } finally {
      inFlightSync.delete(slug);
    }
  })();

  inFlightSync.set(slug, syncPromise);
  return syncPromise;
}

/** The English source PDF for a book, or null if it has not been uploaded. */
export function getBookSource(slugOrBook: string | Book): BookSource | null {
  const slug = typeof slugOrBook === "string" ? slugOrBook : slugOrBook.slug;
  if (!slug) return null;

  const cachedResult = sourceCache.get(slug);
  if (cachedResult && Date.now() - cachedResult.at < 30_000) {
    return cachedResult.source;
  }

  const filePath = findExistingLocalPath(slug);
  if (!filePath) {
    sourceCache.set(slug, { at: Date.now(), source: null });
    return null;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) {
      sourceCache.set(slug, { at: Date.now(), source: null });
      return null;
    }
  } catch {
    sourceCache.set(slug, { at: Date.now(), source: null });
    return null;
  }

  const cached = versionCache.get(filePath);
  let version = cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size ? cached.version : "";
  if (!version) {
    let hash = "";
    try {
      const fd = fs.openSync(filePath, "r");
      const readLen = Math.min(65536, stat.size);
      const buf = Buffer.alloc(readLen);
      fs.readSync(fd, buf, 0, readLen, 0);
      fs.closeSync(fd);
      hash = crypto.createHash("sha256").update(buf).update(`${stat.size}-${stat.mtimeMs}`).digest("hex").slice(0, 12);
    } catch {
      hash = crypto.createHash("sha256").update(`${stat.size}-${stat.mtimeMs}`).digest("hex").slice(0, 12);
    }
    version = `v-${hash}`;
    versionCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, version });
  }
  const book = typeof slugOrBook === "string" ? getBook(slugOrBook) : slugOrBook;
  const sourceLanguage = book?.sourceLanguage ?? "en";
  const result: BookSource = { slug, sourceLanguage, filePath, version, bytes: stat.size };
  sourceCache.set(slug, { at: Date.now(), source: result });
  return result;
}

const verifiedVersions = new Map<string, boolean>();

/**
 * True only when the book can really be delivered: its private PDF is present AND opens as a valid,
 * unencrypted PDF with at least one page. Checked once per file version. Books that fail this
 * cannot be ordered (see lib/server/purchase.ts), so no one is charged for a book we can't send.
 */
export async function bookDeliverable(slugOrBook: string | Book): Promise<boolean> {
  await ensureBookSource(slugOrBook);
  const source = getBookSource(slugOrBook);
  if (!source) return false;
  const key = `${source.filePath}:${source.version}`;
  if (!verifiedVersions.has(key)) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(new Uint8Array(fs.readFileSync(/*turbopackIgnore: true*/ source.filePath)), { updateMetadata: false });
      verifiedVersions.set(key, doc.getPageCount() > 0);
    } catch {
      verifiedVersions.set(key, false); // not a PDF, damaged or password-protected
    }
  }
  return verifiedVersions.get(key)!;
}

/** Cache key: one translation per book + source language + target language + source version. */
export function translationCacheKey(slug: string, source: string, target: string, version: string): string {
  return `${slug}:${source}:${target}:${version}`;
}
