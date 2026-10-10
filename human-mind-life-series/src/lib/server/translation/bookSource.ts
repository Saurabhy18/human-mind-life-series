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
  const filePath = path.join(PRIVATE_BOOKS_DIR, `${book.slug}.pdf`);
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

/** Cache key: one translation per book + source language + target language + source version. */
export function translationCacheKey(slug: string, source: string, target: string, version: string): string {
  return `${slug}:${source}:${target}:${version}`;
}
