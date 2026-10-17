import "server-only";
import { z } from "zod";
import { getPackage, type PackageId, type PurchasePackage } from "@/config/packages";
import { packageAvailable } from "@/lib/products";
import { getBookFromDbOrStatic } from "./books";
import { validateOrderLanguage } from "./orderLanguage";
import { bookDeliverable } from "./translation/bookSource";
import type { NewOrderItem } from "./orders";

/**
 * SERVER-SIDE PURCHASE VALIDATION.
 * The browser sends only: package id, book ids and a language per book.
 * Everything else — which books are allowed, how many, and the PRICE — is
 * decided here from src/config/packages.ts. Any amount the browser sends is ignored.
 */

export type ValidPurchase = {
  packageId: PackageId;
  packageName: string;
  /** From the package configuration, never from the request. */
  amount: number;
  currency: string;
  /** Book slug (individual) or package id (bundle). */
  productSlug: string;
  productTitle: string;
  author: string;
  items: (NewOrderItem & { languageName: string })[];
};

export type PurchaseField = "packageId" | "items" | "languages";
export type PurchaseResult = { ok: true; purchase: ValidPurchase } | { ok: false; field: PurchaseField; message: string };

export const PURCHASE_MESSAGES = {
  invalidPackage: "Please choose a valid package.",
  invalidBook: "One of the selected ebooks is not available. Please choose again.",
  duplicateBook: "Each ebook can only be selected once.",
  missingLanguage: "Please select a language for each ebook.",
  notDeliverable: (title: string, bundle: boolean) =>
    bundle ? `“${title}” is not available for online purchase yet, so this bundle can’t be bought right now.` : `“${title}” is not available for online purchase yet.`,
  count: (pkg: PurchasePackage) => (pkg.books === 1 ? "Please select 1 ebook." : `Please select exactly ${pkg.books} ebooks for this bundle.`),
};

const itemsSchema = z
  .array(
    z.object({
      bookId: z.string().trim().min(1).max(80),
      language: z.string().trim().max(20).optional(),
    }),
  )
  .min(1)
  .max(10);

/**
 * Reads the selection from a request body: { packageId, items: [{ bookId, language }] }.
 * Older single-book requests ({ bookId | product, targetLanguage }) are read as an Individual Ebook order.
 */
export function readSelection(body: { packageId?: unknown; items?: unknown; bookId?: unknown; product?: unknown; targetLanguage?: unknown }): { packageId: unknown; items: unknown } {
  if (body.packageId !== undefined || body.items !== undefined) return { packageId: body.packageId, items: body.items };
  const bookId = typeof body.bookId === "string" ? body.bookId : body.product;
  if (typeof bookId !== "string") return { packageId: undefined, items: undefined };
  const lang = typeof body.targetLanguage === "string" && body.targetLanguage.trim() ? body.targetLanguage : (getBookFromDbOrStatic(bookId)?.sourceLanguage ?? "en");
  return { packageId: "individual", items: [{ bookId, language: lang }] };
}

/** Parses the `items` field of a multipart form (a JSON string). */
export function parseItemsField(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || raw.length > 4000) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export async function validatePurchase(packageId: unknown, rawItems: unknown): Promise<PurchaseResult> {
  const pkg = getPackage(packageId);
  if (!pkg || !packageAvailable(pkg)) return { ok: false, field: "packageId", message: PURCHASE_MESSAGES.invalidPackage };

  const parsed = itemsSchema.safeParse(rawItems);
  if (!parsed.success) return { ok: false, field: "items", message: PURCHASE_MESSAGES.count(pkg) };
  const requested = parsed.data;
  if (requested.length !== pkg.books) return { ok: false, field: "items", message: PURCHASE_MESSAGES.count(pkg) };

  const books = requested.map((r) => getBookFromDbOrStatic(r.bookId));
  if (books.some((b) => !b)) return { ok: false, field: "items", message: PURCHASE_MESSAGES.invalidBook };
  if (new Set(books.map((b) => b!.slug)).size !== books.length) return { ok: false, field: "items", message: PURCHASE_MESSAGES.duplicateBook };
  // Never take money for a book we cannot deliver: every book's PDF must be present and valid.
  for (const book of books) {
    if (!(await bookDeliverable(book!))) return { ok: false, field: "items", message: PURCHASE_MESSAGES.notDeliverable(book!.title, pkg.books > 1) };
  }
  if (requested.some((r) => !r.language)) return { ok: false, field: "languages", message: PURCHASE_MESSAGES.missingLanguage };

  const items: ValidPurchase["items"] = [];
  for (const [i, r] of requested.entries()) {
    const book = books[i]!;
    const lang = await validateOrderLanguage(book.slug, r.language);
    if (!lang.ok) return { ok: false, field: "languages", message: books.length > 1 ? `${book.title}: ${lang.message}` : lang.message };
    items.push({
      book_slug: book.slug,
      book_title: book.label,
      author: book.author,
      source_language: lang.source,
      target_language: lang.language.code,
      languageName: lang.language.name,
    });
  }
  // Always in series order, whatever order the customer clicked them in.
  const byVolume = (slug: string) => getBookFromDbOrStatic(slug)?.volume ?? 99;
  items.sort((a, b) => byVolume(a.book_slug) - byVolume(b.book_slug));

  const single = pkg.books === 1 ? getBookFromDbOrStatic(items[0].book_slug)! : null;
  const volumes = items.map((it) => getBookFromDbOrStatic(it.book_slug)?.volume ?? 0).filter((v) => v > 0);
  return {
    ok: true,
    purchase: {
      packageId: pkg.id,
      packageName: pkg.name,
      amount: pkg.price,
      currency: pkg.currency,
      productSlug: single ? single.slug : pkg.id,
      productTitle: single
        ? single.label
        : volumes.length === items.length
          ? `${pkg.name} — Volumes ${volumes.join(", ")}`
          : `${pkg.name} — ${items.map((it) => it.book_title).join(", ")}`,
      author: single ? single.author : [...new Set(items.map((it) => it.author ?? ""))].filter(Boolean).join(", "),
      items,
    },
  };
}
