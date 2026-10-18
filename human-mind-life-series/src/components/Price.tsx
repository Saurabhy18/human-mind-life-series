"use client";

import { discountPercent } from "@/config/packages";
import { useCurrency } from "@/components/currency/CurrencyContext";

const ORIGINAL_SIZE = { sm: "text-[0.8rem]", md: "text-[0.95rem]", lg: "text-xl" } as const;

export type PriceProps = {
  /** The amount in INR (the base/charged currency). It is shown converted to the visitor's chosen display currency. */
  amount: number;
  originalPrice?: number | null;
  /** Base currency of `amount`; always INR in this store. Kept for call-site clarity. */
  currency?: string;
  /** Styles the current price (size, weight, colour). */
  priceClassName?: string;
  className?: string;
  /** Size of the struck-through original price; the current price stays the most prominent. */
  size?: keyof typeof ORIGINAL_SIZE;
  tone?: "light" | "dark";
  align?: "start" | "end";
};

/**
 * A selling price with its discount:  ~~₹599~~  50% OFF  ₹299
 * Without a higher original price it renders only the price, exactly as before.
 * The original price is display-only; customers are always charged `amount`.
 */
export function Price({ amount, originalPrice, priceClassName = "", className = "", size = "md", tone = "light", align = "start" }: PriceProps) {
  const { format } = useCurrency();
  // The discount percentage is currency-invariant, so compute it on the INR amounts.
  const off = discountPercent(amount, originalPrice);
  if (!off || !originalPrice) return <Money inrAmount={amount} className={priceClassName} />;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle ${align === "end" ? "justify-end" : ""} ${className}`}>
      <span className="sr-only">Original price </span>
      <s className={`${ORIGINAL_SIZE[size]} leading-none decoration-1 ${tone === "dark" ? "text-white/55" : "text-muted"}`}>{format(originalPrice)}</s>
      <span className="discount-badge">{off}% OFF</span>
      <span className="sr-only">, now </span>
      <Money inrAmount={amount} className={priceClassName} />
    </span>
  );
}

/**
 * One price with the currency symbol rendered in bold so it reads clearly on
 * every device. `symbol + amount` is exactly what `format()` returns, so the
 * figure shown (and the INR amount charged) is unchanged.
 */
function Money({ inrAmount, className = "" }: { inrAmount: number; className?: string }) {
  const { formatParts } = useCurrency();
  const { symbol, amount } = formatParts(inrAmount);
  return (
    <span className={`font-semibold ${className}`}>
      <span className="font-bold">{symbol}</span>
      {amount}
    </span>
  );
}
