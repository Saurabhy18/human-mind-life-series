/**
 * Pure currency-conversion helpers (no React, no network) shared by the
 * client currency context and the exchange-rate API route, and unit-tested
 * directly. Base amounts are always in INR (see src/config/currencies.ts).
 */
import { formatMoney, formatMoneyParts } from "@/config/packages";
import { BASE_CURRENCY, type CurrencyCode } from "@/config/currencies";

/** Exchange rates keyed by currency code: target units per 1 INR (base). */
export type Rates = Partial<Record<string, number>>;

/** Convert a base-INR amount into another currency using `rate` (target units per 1 INR). */
export function convertFromBase(inrAmount: number, rate: number): number {
  return inrAmount * rate;
}

/**
 * Format a base-INR amount in the chosen display currency.
 * Falls back to INR when the currency is the base or no usable rate is known,
 * so a missing/zero rate can never show a wrong (e.g. ₹0 or NaN) price.
 */
export function formatInCurrency(inrAmount: number, currency: CurrencyCode, rates: Rates): string {
  if (currency === BASE_CURRENCY) return formatMoney(inrAmount, BASE_CURRENCY);
  const rate = rates[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return formatMoney(inrAmount, BASE_CURRENCY);
  }
  return formatMoney(convertFromBase(inrAmount, rate), currency);
}

/**
 * Like `formatInCurrency`, but returns the currency symbol and the numeric part
 * separately (for styling the symbol). Uses the exact same conversion and
 * fallback rules, so `symbol + amount` equals `formatInCurrency(...)`.
 */
export function formatInCurrencyParts(inrAmount: number, currency: CurrencyCode, rates: Rates): { symbol: string; amount: string } {
  if (currency === BASE_CURRENCY) return formatMoneyParts(inrAmount, BASE_CURRENCY);
  const rate = rates[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return formatMoneyParts(inrAmount, BASE_CURRENCY);
  }
  return formatMoneyParts(convertFromBase(inrAmount, rate), currency);
}
