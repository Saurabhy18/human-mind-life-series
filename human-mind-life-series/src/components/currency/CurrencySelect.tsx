"use client";

import { Globe2 } from "lucide-react";
import { CURRENCIES, isSupportedCurrency } from "@/config/currencies";
import { useCurrency } from "./CurrencyContext";

/**
 * Lets the visitor pick the currency prices are shown in. Display-only: the
 * amount charged is always INR (a note at checkout makes this explicit).
 */
export function CurrencySelect({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <label className={`inline-flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <span className="sr-only">Display currency</span>
      {/* Decorative globe to the left of the selector */}
      <Globe2 size={18} strokeWidth={2} color="#B68B43" aria-hidden="true" className="shrink-0 hidden xs:inline-block sm:inline-block" />
      <select
        value={currency}
        onChange={(e) => {
          if (isSupportedCurrency(e.target.value)) setCurrency(e.target.value);
        }}
        aria-label="Display currency"
        className="cursor-pointer rounded-full border border-line bg-white/70 py-1 sm:py-1.5 pr-6 sm:pr-7 pl-2 sm:pl-3 text-xs sm:text-sm font-medium text-ink transition hover:border-ink/40 focus:border-gold focus:ring-2 focus:ring-gold/25 focus:outline-none"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}
