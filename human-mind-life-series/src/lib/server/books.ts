import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb, PRIVATE_BOOKS_DIR } from "./db";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { ENV } from "@/config/env.server";
import { ALL_BOOKS, FREE_BOOKS, PAID_BOOKS, getBook, getProduct, getFreeBook, type Book, type Product } from "@/lib/products";
import { clearBookSourceCache } from "./translation/bookSource";

export type DbBook = {
  id: number;
  slug: string;
  title: string;
  author: string;
  volume: number | null;
  tagline: string | null;
  short_description: string | null;
  description: string | null;
  price: number;
  original_price: number | null;
  currency: string;
  is_free: boolean;
  for_sale: boolean;
  pdf_filename: string;
  cover_image: string | null;
  source_language: string;
  learn: string[];
  topics: string[];
  toc: string[];
  faqs: Array<{ q: string; a: string }>;
  sample: { heading: string; paragraphs: string[] } | null;
  disclaimer: string | null;
  hide_volume_label: boolean;
  adults_only: boolean;
  cover_bg: string;
  cover_accent: string;
  created_at: string;
  updated_at: string;
};

export type NewDbBookInput = {
  slug: string;
  title: string;
  author: string;
  volume?: number | null;
  tagline?: string | null;
  short_description?: string | null;
  description?: string | null;
  price?: number;
  original_price?: number | null;
  currency?: string;
  is_free?: boolean;
  for_sale?: boolean;
  pdf_filename: string;
  cover_image?: string | null;
  source_language?: string;
  learn?: string[];
  topics?: string[];
  toc?: string[];
  faqs?: Array<{ q: string; a: string }>;
  sample?: { heading: string; paragraphs: string[] } | null;
  disclaimer?: string | null;
  hide_volume_label?: boolean;
  adults_only?: boolean;
  cover_bg?: string;
  cover_accent?: string;
};

function parseJsonArray<T>(val: unknown, fallback: T[] = []): T[] {
  if (!val) return fallback;
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseJsonObject<T>(val: unknown, fallback: T | null = null): T | null {
  if (!val) return fallback;
  if (typeof val === "object" && !Array.isArray(val)) return val as T;
  if (typeof val === "string") {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeDbBook(row: Record<string, unknown>): DbBook {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    author: String(row.author || ""),
    volume: row.volume != null ? Number(row.volume) : null,
    tagline: row.tagline ? String(row.tagline) : null,
    short_description: row.short_description ? String(row.short_description) : null,
    description: row.description ? String(row.description) : null,
    price: Number(row.price || 0),
    original_price: row.original_price != null ? Number(row.original_price) : null,
    currency: String(row.currency || "INR"),
    is_free: Boolean(row.is_free),
    for_sale: Boolean(row.for_sale),
    pdf_filename: String(row.pdf_filename),
    cover_image: row.cover_image ? String(row.cover_image) : null,
    source_language: String(row.source_language || "en"),
    learn: parseJsonArray<string>(row.learn),
    topics: parseJsonArray<string>(row.topics),
    toc: parseJsonArray<string>(row.toc),
    faqs: parseJsonArray<{ q: string; a: string }>(row.faqs),
    sample: parseJsonObject<{ heading: string; paragraphs: string[] }>(row.sample),
    disclaimer: row.disclaimer ? String(row.disclaimer) : null,
    hide_volume_label: Boolean(row.hide_volume_label),
    adults_only: Boolean(row.adults_only),
    cover_bg: String(row.cover_bg || "#13233f"),
    cover_accent: String(row.cover_accent || "#c9a24f"),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

let cachedDbBooks: { at: number; books: DbBook[] } | null = null;
const BOOKS_CACHE_TTL = 60_000; // 60 seconds

export function invalidateDbBooksCache() {
  cachedDbBooks = null;
}

/**
 * List all books from the database
 */
export function listDbBooks(): DbBook[] {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return [];
  }
  if (cachedDbBooks && Date.now() - cachedDbBooks.at < BOOKS_CACHE_TTL) {
    return cachedDbBooks.books;
  }
  try {
    const rows = getDb()
      .prepare("SELECT * FROM books ORDER BY volume ASC NULLS LAST, id ASC")
      .all() as Record<string, unknown>[];
    const books = rows.map(normalizeDbBook);
    cachedDbBooks = { at: Date.now(), books };
    return books;
  } catch (err) {
    console.error("listDbBooks query error:", err);
    if (!cachedDbBooks) {
      cachedDbBooks = { at: Date.now() - BOOKS_CACHE_TTL + 10_000, books: [] };
    }
    return cachedDbBooks?.books ?? [];
  }
}

/**
 * Get a single book by slug
 */
export function getDbBookBySlug(slug: string): DbBook | undefined {
  const books = listDbBooks();
  const found = books.find((b) => b.slug === slug);
  if (found) return found;
  if (cachedDbBooks && cachedDbBooks.books.length > 0) {
    return undefined;
  }
  try {
    const row = getDb().prepare("SELECT * FROM books WHERE slug = ?").get(slug) as Record<string, unknown> | undefined;
    return row ? normalizeDbBook(row) : undefined;
  } catch (err) {
    console.error("getDbBookBySlug error:", err);
    return undefined;
  }
}

/**
 * Get a single book by ID
 */
export function getDbBookById(id: number): DbBook | undefined {
  const books = listDbBooks();
  const found = books.find((b) => b.id === id);
  if (found) return found;
  if (cachedDbBooks && cachedDbBooks.books.length > 0) {
    return undefined;
  }
  try {
    const row = getDb().prepare("SELECT * FROM books WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? normalizeDbBook(row) : undefined;
  } catch (err) {
    console.error("getDbBookById error:", err);
    return undefined;
  }
}

/**
 * Upload a PDF file to Supabase Storage bucket
 */
export async function uploadBookPdfToStorage(
  filename: string,
  buffer: Buffer
): Promise<{ ok: boolean; error?: string; path?: string }> {
  try {
    // Also save locally so the file is instantly available on local disk
    try {
      fs.mkdirSync(PRIVATE_BOOKS_DIR, { recursive: true });
      fs.writeFileSync(path.join(PRIVATE_BOOKS_DIR, filename), buffer);
    } catch (localErr) {
      console.warn("[uploadBookPdfToStorage] Warning: Failed to write to local storage dir:", localErr);
    }

    const client = createSupabaseAdminClient();
    if (!client) {
      return { ok: false, error: "Supabase storage is not configured." };
    }
    const bucket = ENV.storage.bucket || "site-files";

    const { error } = await client.storage.from(bucket).upload(filename, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (error) {
      console.error("[uploadBookPdfToStorage] Error:", error);
      return { ok: false, error: error.message };
    }

    clearBookSourceCache();
    return { ok: true, path: filename };
  } catch (err: unknown) {
    console.error("[uploadBookPdfToStorage] Unexpected error:", err);
    return { ok: false, error: (err instanceof Error ? err.message : String(err)) || "PDF upload failed" };
  }
}

/**
 * Delete a PDF file from Supabase Storage bucket and local storage
 */
export async function deleteBookPdfFromStorage(filename: string): Promise<boolean> {
  try {
    try {
      const localPath = path.join(PRIVATE_BOOKS_DIR, filename);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    } catch {}

    const client = createSupabaseAdminClient();
    if (!client) return false;
    const bucket = ENV.storage.bucket || "site-files";
    const { error } = await client.storage.from(bucket).remove([filename]);
    clearBookSourceCache();
    return !error;
  } catch (err) {
    console.error("[deleteBookPdfFromStorage] Error:", err);
    return false;
  }
}

/**
 * Create a new book in the database
 */
export function createDbBook(input: NewDbBookInput): DbBook {
  const db = getDb();
  const slug = input.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");

  const res = db.prepare(`
    INSERT INTO books (
      slug, title, author, volume, tagline, short_description, description,
      price, original_price, currency, is_free, for_sale, pdf_filename,
      cover_image, source_language, learn, topics, toc, faqs, sample,
      disclaimer, hide_volume_label, adults_only, cover_bg, cover_accent,
      created_at, updated_at
    ) VALUES (
      @slug, @title, @author, @volume, @tagline, @short_description, @description,
      @price, @original_price, @currency, @is_free, @for_sale, @pdf_filename,
      @cover_image, @source_language, @learn, @topics, @toc, @faqs, @sample,
      @disclaimer, @hide_volume_label, @adults_only, @cover_bg, @cover_accent,
      NOW(), NOW()
    ) RETURNING id
  `).run({
    slug,
    title: input.title.trim(),
    author: input.author.trim(),
    volume: input.volume != null ? Number(input.volume) : null,
    tagline: input.tagline?.trim() || null,
    short_description: input.short_description?.trim() || null,
    description: input.description?.trim() || null,
    price: input.is_free ? 0 : Number(input.price || 0),
    original_price: input.original_price ? Number(input.original_price) : null,
    currency: input.currency?.trim() || "INR",
    is_free: Boolean(input.is_free),
    for_sale: Boolean(input.for_sale),
    pdf_filename: input.pdf_filename.trim(),
    cover_image: input.cover_image?.trim() || null,
    source_language: input.source_language?.trim() || "en",
    learn: JSON.stringify(input.learn || []),
    topics: JSON.stringify(input.topics || []),
    toc: JSON.stringify(input.toc || []),
    faqs: JSON.stringify(input.faqs || []),
    sample: input.sample ? JSON.stringify(input.sample) : null,
    disclaimer: input.disclaimer?.trim() || null,
    hide_volume_label: Boolean(input.hide_volume_label),
    adults_only: Boolean(input.adults_only),
    cover_bg: input.cover_bg?.trim() || "#13233f",
    cover_accent: input.cover_accent?.trim() || "#c9a24f",
  });

  const id = Number(res.lastInsertRowid);
  invalidateDbBooksCache();
  const created = getDbBookById(id);
  if (!created) throw new Error("Failed to retrieve created book.");
  return created;
}

/**
 * Update an existing book in the database
 */
export function updateDbBook(id: number, input: Partial<NewDbBookInput>): DbBook {
  const existing = getDbBookById(id);
  if (!existing) throw new Error("Book not found.");

  const slug = input.slug
    ? input.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")
    : existing.slug;

  const isFree = input.is_free !== undefined ? Boolean(input.is_free) : existing.is_free;
  const price = isFree ? 0 : input.price !== undefined ? Number(input.price) : existing.price;

  getDb().prepare(`
    UPDATE books SET
      slug = @slug,
      title = @title,
      author = @author,
      volume = @volume,
      tagline = @tagline,
      short_description = @short_description,
      description = @description,
      price = @price,
      original_price = @original_price,
      currency = @currency,
      is_free = @is_free,
      for_sale = @for_sale,
      pdf_filename = @pdf_filename,
      cover_image = @cover_image,
      source_language = @source_language,
      learn = @learn,
      topics = @topics,
      toc = @toc,
      faqs = @faqs,
      sample = @sample,
      disclaimer = @disclaimer,
      hide_volume_label = @hide_volume_label,
      adults_only = @adults_only,
      cover_bg = @cover_bg,
      cover_accent = @cover_accent,
      updated_at = NOW()
    WHERE id = @id
  `).run({
    id,
    slug,
    title: input.title !== undefined ? input.title.trim() : existing.title,
    author: input.author !== undefined ? input.author.trim() : existing.author,
    volume: input.volume !== undefined ? (input.volume != null ? Number(input.volume) : null) : existing.volume,
    tagline: input.tagline !== undefined ? input.tagline?.trim() || null : existing.tagline,
    short_description: input.short_description !== undefined ? input.short_description?.trim() || null : existing.short_description,
    description: input.description !== undefined ? input.description?.trim() || null : existing.description,
    price,
    original_price: input.original_price !== undefined ? (input.original_price ? Number(input.original_price) : null) : existing.original_price,
    currency: input.currency !== undefined ? input.currency.trim() : existing.currency,
    is_free: isFree,
    for_sale: input.for_sale !== undefined ? Boolean(input.for_sale) : existing.for_sale,
    pdf_filename: input.pdf_filename !== undefined ? input.pdf_filename.trim() : existing.pdf_filename,
    cover_image: input.cover_image !== undefined ? input.cover_image?.trim() || null : existing.cover_image,
    source_language: input.source_language !== undefined ? input.source_language.trim() : existing.source_language,
    learn: input.learn !== undefined ? JSON.stringify(input.learn) : JSON.stringify(existing.learn),
    topics: input.topics !== undefined ? JSON.stringify(input.topics) : JSON.stringify(existing.topics),
    toc: input.toc !== undefined ? JSON.stringify(input.toc) : JSON.stringify(existing.toc),
    faqs: input.faqs !== undefined ? JSON.stringify(input.faqs) : JSON.stringify(existing.faqs),
    sample: input.sample !== undefined ? (input.sample ? JSON.stringify(input.sample) : null) : (existing.sample ? JSON.stringify(existing.sample) : null),
    disclaimer: input.disclaimer !== undefined ? input.disclaimer?.trim() || null : existing.disclaimer,
    hide_volume_label: input.hide_volume_label !== undefined ? Boolean(input.hide_volume_label) : existing.hide_volume_label,
    adults_only: input.adults_only !== undefined ? Boolean(input.adults_only) : existing.adults_only,
    cover_bg: input.cover_bg !== undefined ? input.cover_bg.trim() : existing.cover_bg,
    cover_accent: input.cover_accent !== undefined ? input.cover_accent.trim() : existing.cover_accent,
  });

  invalidateDbBooksCache();
  const updated = getDbBookById(id);
  if (!updated) throw new Error("Failed to retrieve updated book.");
  return updated;
}

/**
 * Toggle free or sale status
 */
export function toggleBookStatus(
  id: number,
  field: "is_free" | "for_sale",
  value: boolean
): DbBook {
  const existing = getDbBookById(id);
  if (!existing) throw new Error("Book not found.");

  if (field === "is_free") {
    return updateDbBook(id, { is_free: value, price: value ? 0 : (existing.price || 299) });
  } else {
    return updateDbBook(id, { for_sale: value });
  }
}

/**
 * Delete a book from the database
 */
export async function deleteDbBook(id: number, deletePdfFromStorage = false): Promise<boolean> {
  const existing = getDbBookById(id);
  if (!existing) return false;

  getDb().prepare("DELETE FROM books WHERE id = ?").run(id);
  invalidateDbBooksCache();

  if (deletePdfFromStorage && existing.pdf_filename) {
    await deleteBookPdfFromStorage(existing.pdf_filename);
  }

  return true;
}

/**
 * Convert a DbBook into the site-wide Book interface
 */
export function dbBookToProductBook(b: DbBook): Book {
  return {
    volume: (b.volume as 1 | 2 | 3 | 4 | 5 | 6) || 1,
    slug: b.slug,
    title: b.title,
    tagline: b.tagline || "",
    shortDescription: b.short_description || "",
    description: b.description ? (b.description.includes("\n\n") ? b.description.split("\n\n") : b.description.split("\n")) : [],
    learn: b.learn || [],
    topics: b.topics || [],
    toc: b.toc || [],
    sample: b.sample,
    faqs: b.faqs || [],
    disclaimer: b.disclaimer || undefined,
    sourceLanguage: b.source_language || "en",
    hideVolumeLabel: b.hide_volume_label,
    adultsOnly: b.adults_only,
    coverTheme: { bg: b.cover_bg || "#13233f", accent: b.cover_accent || "#c9a24f" },
    seo: {
      title: `${b.title}${b.volume ? ` — Volume ${b.volume}` : ""}`,
      description: b.short_description || b.tagline || b.title,
    },
    currency: "INR" as const,
    author: b.author,
    price: b.is_free ? 0 : Number(b.price || 0),
    originalPrice: b.original_price != null ? Number(b.original_price) : null,
    volumeLabel: b.volume && !b.hide_volume_label ? `Volume ${b.volume}` : null,
    label: b.volume && !b.hide_volume_label ? `Volume ${b.volume} — ${b.title}` : b.title,
    free: b.is_free,
    cover: b.cover_image,
    pdfFilename: b.pdf_filename,
  };
}

/**
 * Retrieve the active books catalogue from the database with graceful static fallback
 */
export function getSiteCatalog(): { allBooks: Book[]; paidBooks: Book[]; freeBooks: Book[] } {
  try {
    const dbBooks = listDbBooks();
    if (dbBooks.length > 0) {
      // Filter out any draft/unlisted books that are neither for sale nor free
      const activeDbBooks = dbBooks.filter((b) => b.for_sale || b.is_free);
      if (activeDbBooks.length > 0) {
        const allBooks = activeDbBooks.map(dbBookToProductBook);
        const paidBooks = allBooks.filter((b) => !b.free && b.price > 0);
        const freeBooks = allBooks.filter((b) => b.free);
        return { allBooks, paidBooks, freeBooks };
      }
    }
  } catch (err) {
    console.error("Failed to load catalog from database, falling back to static:", err);
  }

  return {
    allBooks: ALL_BOOKS,
    paidBooks: PAID_BOOKS,
    freeBooks: FREE_BOOKS,
  };
}

/**
 * Look up a book from the database or fall back to the static catalogue
 */
export function getBookFromDbOrStatic(slug: string): Book | undefined {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return getBook(slug);
  }
  try {
    const dbBook = getDbBookBySlug(slug);
    if (dbBook) return dbBookToProductBook(dbBook);
  } catch (err) {
    console.error("Failed to load book from database:", err);
  }
  return getBook(slug);
}

/**
 * Look up a paid product from the database or fall back to static
 */
export function getDbProduct(slug: string): Product | undefined {
  try {
    const dbBook = getDbBookBySlug(slug);
    if (dbBook && dbBook.for_sale && dbBook.price > 0) {
      return {
        slug: dbBook.slug,
        title: dbBook.title,
        author: dbBook.author,
        label: dbBook.volume && !dbBook.hide_volume_label ? `Volume ${dbBook.volume} — ${dbBook.title}` : dbBook.title,
        price: dbBook.price,
      };
    }
  } catch (err) {
    console.error("Failed to load product from database:", err);
  }
  return getProduct(slug);
}

/**
 * Look up a free book from the database or fall back to static
 */
export function getDbFreeBook(slug: string): Book | undefined {
  try {
    const dbBook = getDbBookBySlug(slug);
    if (dbBook && dbBook.is_free) {
      return dbBookToProductBook(dbBook);
    }
  } catch (err) {
    console.error("Failed to load free book from database:", err);
  }
  return getFreeBook(slug);
}


