/**
 * PURCHASE PACKAGES — the ONE place where paid-book prices are set.
 *
 *   individual         → any 1 ebook      ₹299 (shown as ₹599 → 50% OFF → ₹299)
 *   three_book_bundle  → any 3 ebooks     ₹649 (a fixed bundle price, NOT 3 × ₹299)
 *   five_book_bundle   → all 5 ebooks     ₹999 (a fixed bundle price, NOT 5 × ₹299)
 *
 * The customer chooses a package, its books and a language for each book.
 * The SERVER looks the price up here (src/lib/server/purchase.ts); a price
 * sent by the browser is never used.
 *
 * Amounts are whole units of `currency`. To sell in another currency later,
 * add the currency here (and in the payment gateway) — nothing else stores ₹.
 *
 * Safe for the browser: contains no secrets.
 */
export type PackageId = "individual" | "three_book_bundle" | "five_book_bundle";

export type PurchasePackage = {
  id: PackageId;
  /** Shown in the order summary, admin and emails. */
  name: string;
  /** Shown on the package choice in checkout. */
  label: string;
  /** EXACT number of different ebooks in the package. */
  books: number;
  /** What the customer pays — the ONLY amount ever charged. */
  price: number;
  /** Optional original price, shown struck through with a "% OFF" badge. Never charged. */
  originalPrice?: number;
  currency: "INR";
};

export const PACKAGES: Record<PackageId, PurchasePackage> = {
  individual: { id: "individual", name: "Individual Ebook", label: "Individual Ebook", books: 1, price: 299, originalPrice: 599, currency: "INR" },
  three_book_bundle: { id: "three_book_bundle", name: "3 Book Bundle", label: "Choose Any 3 Books", books: 3, price: 649, currency: "INR" },
  five_book_bundle: { id: "five_book_bundle", name: "5 Book Bundle", label: "Complete 5 Book Bundle", books: 5, price: 999, currency: "INR" },
};

/** What the browser sends when ordering (no prices): POST /api/orders { packageId, items }. */
export type PurchaseSelection = { packageId: PackageId; items: { bookId: string; language: string }[] };

/** Display order in checkout. */
export const PACKAGE_IDS: readonly PackageId[] = ["individual", "three_book_bundle", "five_book_bundle"];

export function getPackage(id: unknown): PurchasePackage | undefined {
  return typeof id === "string" && Object.hasOwn(PACKAGES, id) ? PACKAGES[id as PackageId] : undefined;
}

/**
 * Whole-number discount shown on the badge, rounded DOWN so it never overstates
 * the saving (₹599 → ₹299 = 50.08% → "50% OFF"). 0 when there is no discount.
 */
export function discountPercent(price: number, originalPrice: number | null | undefined): number {
  if (!originalPrice || originalPrice <= price || price < 0) return 0;
  return Math.floor((1 - price / originalPrice) * 100);
}

/** "₹299" for INR; other currencies use the standard symbol for that currency. */
export function formatMoney(amount: number, currency: string = "INR"): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount);
}
