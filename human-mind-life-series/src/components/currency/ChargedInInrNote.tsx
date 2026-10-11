"use client";

import { BASE_CURRENCY } from "@/config/currencies";
import { formatMoney } from "@/config/packages";
import { useCurrency } from "./CurrencyContext";

/**
 * Shown at checkout only when prices are being viewed in a non-INR currency:
 * makes clear the customer is charged the INR amount, with the converted figure
 * for reference. Renders nothing when the display currency is INR.
 */
export function ChargedInInrNote({ inrAmount, className = "" }: { inrAmount: number; className?: string }) {
  const { currency, format } = useCurrency();
  if (currency === BASE_CURRENCY) return null;
  return (
    <p className={`text-xs leading-relaxed text-muted ${className}`}>
      Prices in {currency} are for reference only. You will be charged{" "}
      <span className="font-semibold text-ink">{formatMoney(inrAmount, BASE_CURRENCY)}</span> (≈ {format(inrAmount)}) in Indian Rupees.
    </p>
  );
}
