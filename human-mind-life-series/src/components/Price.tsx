import { discountPercent, formatMoney } from "@/config/packages";

const ORIGINAL_SIZE = { sm: "text-[0.8rem]", md: "text-[0.95rem]", lg: "text-xl" } as const;

export type PriceProps = {
  amount: number;
  originalPrice?: number | null;
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
export function Price({ amount, originalPrice, currency = "INR", priceClassName = "", className = "", size = "md", tone = "light", align = "start" }: PriceProps) {
  const off = discountPercent(amount, originalPrice);
  const current = formatMoney(amount, currency);
  if (!off || !originalPrice) return <span className={priceClassName}>{current}</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle ${align === "end" ? "justify-end" : ""} ${className}`}>
      <span className="sr-only">Original price </span>
      <s className={`${ORIGINAL_SIZE[size]} leading-none decoration-1 ${tone === "dark" ? "text-white/55" : "text-muted"}`}>{formatMoney(originalPrice, currency)}</s>
      <span className="discount-badge">{off}% OFF</span>
      <span className="sr-only">, now </span>
      <span className={priceClassName}>{current}</span>
    </span>
  );
}
