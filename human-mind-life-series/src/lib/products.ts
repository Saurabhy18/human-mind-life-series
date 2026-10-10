import { CONFIG, isPlaceholder } from "@/config/site.config";
import { PACKAGES, formatMoney, type PackageId, type PurchasePackage } from "@/config/packages";
import { BOOKS, type BookContent } from "@/content/books";

export type Book = Omit<BookContent, "sourceLanguage"> & {
  /** Language the book is written in (Google language code). */
  sourceLanguage: string;
  currency: "INR";
  /** Pen name of this volume's author (from site.config.ts). */
  author: string;
  /** What the customer pays (₹0 for free books). */
  price: number;
  /** Original price shown struck through next to `price` (e.g. ₹599), or null when there is no discount. Never charged. */
  originalPrice: number | null;
  /** "Volume 4", or null for a book shown without a volume number (The Intimacy Code). */
  volumeLabel: string | null;
  /** Display name: "Volume 4 — Intimacy After 50", or just the title when the volume label is hidden. */
  label: string;
  /** True when the price is 0: the book is given away, never sold through the UPI payment page. */
  free: boolean;
  /** Uploaded cover image path, or null to use the built-in typographic cover. */
  cover: string | null;
};

/** Anything that can be PAID for: a single paid volume or the complete-series bundle. Free books are never products. */
export type Product = {
  slug: string;
  title: string;
  /** Author pen name(s) for this product. */
  author: string;
  label: string;
  price: number;
};

/** Every paid book costs the Individual Ebook price (src/config/packages.ts); only free books are listed here. */
const PRICE_OVERRIDES: Record<number, number> = {
  6: CONFIG.BOOK_6_PRICE,
};

const AUTHORS: Record<number, string> = {
  1: CONFIG.AUTHOR_VOLUME_1,
  2: CONFIG.AUTHOR_VOLUME_2,
  3: CONFIG.AUTHOR_VOLUME_3,
  4: CONFIG.AUTHOR_VOLUME_4,
  5: CONFIG.AUTHOR_VOLUME_5,
  6: CONFIG.AUTHOR_VOLUME_6,
};

const COVERS: Record<number, string> = {
  1: CONFIG.BOOK_COVER_1,
  2: CONFIG.BOOK_COVER_2,
  3: CONFIG.BOOK_COVER_3,
  4: CONFIG.BOOK_COVER_4,
  5: CONFIG.BOOK_COVER_5,
  6: CONFIG.BOOK_COVER_6,
};

export const ALL_BOOKS: Book[] = BOOKS.map((b) => {
  const price = Math.max(0, PRICE_OVERRIDES[b.volume] ?? PACKAGES.individual.price);
  // Only books sold at the Individual Ebook price carry its original price; free books never do.
  const original = PRICE_OVERRIDES[b.volume] === undefined ? PACKAGES.individual.originalPrice : undefined;
  return {
    ...b,
    sourceLanguage: b.sourceLanguage ?? "en",
    currency: PACKAGES.individual.currency,
    author: AUTHORS[b.volume],
    volumeLabel: b.hideVolumeLabel ? null : `Volume ${b.volume}`,
    label: b.hideVolumeLabel ? b.title : `Volume ${b.volume} — ${b.title}`,
    price,
    originalPrice: price > 0 && original && original > price ? original : null,
    free: price === 0,
    cover: isPlaceholder(COVERS[b.volume]) ? null : COVERS[b.volume],
  };
});

export const PAID_BOOKS = ALL_BOOKS.filter((b) => !b.free);
export const FREE_BOOKS = ALL_BOOKS.filter((b) => b.free);

/** All pen names, in volume order. */
export const ALL_AUTHORS = ALL_BOOKS.map((b) => ({ name: b.author, volume: b.volume, title: b.title, slug: b.slug }));

/** /checkout/complete-series opens checkout with the 5-book bundle selected. */
export const BUNDLE_SLUG = "complete-series";

export function getBook(slug: string): Book | undefined {
  return ALL_BOOKS.find((b) => b.slug === slug);
}

export function getFreeBook(slug: string): Book | undefined {
  return FREE_BOOKS.find((b) => b.slug === slug);
}

/** Where a book's main button goes: the free-copy form for free books, the UPI payment page for paid ones. */
export function bookActionHref(book: Book): string {
  return book.free ? `/books/${book.slug}#get-free` : `/checkout/${book.slug}`;
}

export function bookActionLabel(book: Book): string {
  return book.free ? "GET FREE BOOK" : "Buy Now";
}

export function formatPrice(book: Pick<Book, "price" | "free">): string {
  return book.free ? "FREE" : formatINR(book.price);
}

/** e.g. "Volumes 1–5" for the paid volumes. */
export function volumeRange(books: Book[]): string {
  const v = books.map((b) => b.volume);
  return v.length === 1 ? `Volume ${v[0]}` : `Volumes ${Math.min(...v)}–${Math.max(...v)}`;
}

/** A package is offered only when there are enough paid books for it. */
export function packageAvailable(pkg: PurchasePackage): boolean {
  return pkg.books >= 1 && pkg.books <= PAID_BOOKS.length;
}

/** True when the package contains every paid book (nothing to choose). */
export function packageIncludesAll(pkg: PurchasePackage): boolean {
  return pkg.books === PAID_BOOKS.length;
}

/** The complete-series offer is the 5-book bundle. */
export function bundleEnabled(): boolean {
  return PAID_BOOKS.length > 1 && packageAvailable(PACKAGES.five_book_bundle);
}

export function bundlePrice(): number {
  return PACKAGES.five_book_bundle.price;
}

/** What `count` books would cost bought one at a time (all paid books by default). */
export function individualTotal(count: number = PAID_BOOKS.length): number {
  return count * PACKAGES.individual.price;
}

/** Checkout with a package (and optionally one of its books) already selected. */
export function packageCheckoutHref(id: PackageId, bookSlug?: string): string {
  if (id === "five_book_bundle") return `/checkout/${BUNDLE_SLUG}`;
  return `/checkout?package=${id}${bookSlug ? `&book=${encodeURIComponent(bookSlug)}` : ""}`;
}

/** How much a bundle saves compared with buying its books individually. */
export function packageSaving(id: PackageId): number {
  const pkg = PACKAGES[id];
  return Math.max(0, individualTotal(pkg.books) - pkg.price);
}

/** Single paid books (bundles are packages, see src/config/packages.ts). */
export function getAllProducts(): Product[] {
  return PAID_BOOKS.map((b) => ({
    slug: b.slug,
    title: b.title,
    author: b.author,
    label: b.label,
    price: b.price,
  }));
}

/** Only paid products — a free book can never be looked up here, so it can never reach the payment page or the order API. */
export function getProduct(slug: string): Product | undefined {
  return getAllProducts().find((p) => p.slug === slug && p.price > 0);
}

export function formatINR(amount: number): string {
  return formatMoney(amount, "INR");
}
