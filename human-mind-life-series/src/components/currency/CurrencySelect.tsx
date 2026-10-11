"use client";

import { CURRENCIES, isSupportedCurrency } from "@/config/currencies";
import { useCurrency } from "./CurrencyContext";

/**
 * Lets the visitor pick the currency prices are shown in. Display-only: the
 * amount charged is always INR (a note at checkout makes this explicit).
 */
export function CurrencySelect({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <label className={`inline-flex items-center ${className}`}>
      <span className="sr-only">Display currency</span>
      <select
        value={currency}
        onChange={(e) => {
          if (isSupportedCurrency(e.target.value)) setCurrency(e.target.value);
        }}
        aria-label="Display currency"
        className="cursor-pointer rounded-full border border-line bg-white/70 py-1.5 pr-7 pl-3 text-sm font-medium text-ink transition hover:border-ink/40 focus:border-gold focus:ring-2 focus:ring-gold/25 focus:outline-none"
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
