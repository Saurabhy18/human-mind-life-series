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

function findExistingLocalPath(slug: string): string | null {
  const registered = resolvedPaths.get(slug);
  if (registered) {
    try {
      const s = fs.statSync(registered);
      if (s.isFile() && s.size > 0) return registered;
    } catch {
      // file no longer exists at registered path
    }
  }

  const primary = path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${slug}.pdf`);
  try {
    const s = fs.statSync(primary);
    if (s.isFile() && s.size > 0) return primary;
  } catch {
    // primary not found
  }

  const fallback = path.join(os.tmpdir(), "books", `${slug}.pdf`);
  try {
    const s = fs.statSync(fallback);
    if (s.isFile() && s.size > 0) return fallback;
  } catch {
    // fallback not found
  }

  return null;
}

const failedSyncs = new Map<string, number>();
const FAILED_SYNC_TTL = 60_000; // 60 seconds

export function clearBookSourceCache(slug?: string) {
  if (slug) {
    failedSyncs.delete(slug);
    resolvedPaths.delete(slug);
  } else {
    failedSyncs.clear();
    resolvedPaths.clear();
  }
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

  const filePath = findExistingLocalPath(slug);
  if (!filePath) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) return null;
  } catch {
    return null;
  }

  const cached = versionCache.get(filePath);
  let version = cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size ? cached.version : "";
  if (!version) {
    const hash = crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 12);
    version = `v-${hash}`;
    versionCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, version });
  }
  const book = typeof slugOrBook === "string" ? getBook(slugOrBook) : slugOrBook;
  const sourceLanguage = book?.sourceLanguage ?? "en";
  return { slug, sourceLanguage, filePath, version, bytes: stat.size };
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
