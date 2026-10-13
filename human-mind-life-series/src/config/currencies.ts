/**
 * DISPLAY CURRENCIES — the currencies a visitor may view prices in.
 *
 * The store is priced and CHARGED in INR (see src/config/packages.ts and the
 * Cashfree / UPI payment flow). These currencies are DISPLAY-ONLY: prices are
 * converted with live exchange rates for reference, but every customer still
 * pays the INR amount. To offer another display currency, add it here — its
 * code must be a valid ISO 4217 code the rates API (and Intl) understands.
 *
 * Safe for the browser: contains no secrets.
 */
export const BASE_CURRENCY = "INR" as const;

export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "AED" | "SGD";

export type CurrencyInfo = {
  code: CurrencyCode;
  /** Shown in the picker, e.g. "$ USD". */
  label: string;
};

/** First entry is the base/default; the rest are offered in the picker in this order. */
export const CURRENCIES: readonly CurrencyInfo[] = [
  { code: "INR", label: "₹ INR" },
  { code: "USD", label: "$ USD" },
  { code: "EUR", label: "€ EUR" },
  { code: "GBP", label: "£ GBP" },
  { code: "AUD", label: "A$ AUD" },
  { code: "CAD", label: "C$ CAD" },
  { code: "AED", label: "د.إ AED" },
  { code: "SGD", label: "S$ SGD" },
];

export const CURRENCY_CODES: readonly CurrencyCode[] = CURRENCIES.map((c) => c.code);

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}
