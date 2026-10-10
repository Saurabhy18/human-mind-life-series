import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PRIVATE_BOOKS_DIR } from "../db";
import { getBook, type Book } from "@/lib/products";

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

/** The English source PDF for a book (storage/books/<slug>.pdf), or null if it has not been uploaded. */
export function getBookSource(slugOrBook: string | Book): BookSource | null {
  const book = typeof slugOrBook === "string" ? getBook(slugOrBook) : slugOrBook;
  if (!book) return null;
  const filePath = path.join(/*turbopackIgnore: true*/ PRIVATE_BOOKS_DIR, `${book.slug}.pdf`);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
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
  return { slug: book.slug, sourceLanguage: book.sourceLanguage, filePath, version, bytes: stat.size };
}

const verifiedVersions = new Map<string, boolean>();

/**
 * True only when the book can really be delivered: its private PDF is present AND opens as a valid,
 * unencrypted PDF with at least one page. Checked once per file version. Books that fail this
 * cannot be ordered (see lib/server/purchase.ts), so no one is charged for a book we can't send.
 */
export async function bookDeliverable(slugOrBook: string | Book): Promise<boolean> {
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
