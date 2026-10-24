"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BASE_CURRENCY, isSupportedCurrency, type CurrencyCode } from "@/config/currencies";
import { formatInCurrency, formatInCurrencyParts, type Rates } from "@/lib/currency";

type CurrencyContextValue = {
  /** The currency prices are currently displayed in. */
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Rates;
  /** True once live rates have loaded (false during SSR and first paint). */
  ready: boolean;
  /** Format a base-INR amount in the selected display currency. */
  format: (inrAmount: number) => string;
  /** Same as `format`, but returns the currency symbol and numeric part separately (for styling the symbol). */
  formatParts: (inrAmount: number) => { symbol: string; amount: string };
};

const STORAGE_KEY = "display-currency";

/**
 * Default value, used during SSR and by any component rendered without a
 * provider (e.g. unit tests): the base currency with no conversion, so output
 * is identical to the INR-only behaviour prices had before this feature.
 */
const DEFAULT: CurrencyContextValue = {
  currency: BASE_CURRENCY,
  setCurrency: () => {},
  rates: { [BASE_CURRENCY]: 1 },
  ready: false,
  format: (inrAmount) => formatInCurrency(inrAmount, BASE_CURRENCY, { [BASE_CURRENCY]: 1 }),
  formatParts: (inrAmount) => formatInCurrencyParts(inrAmount, BASE_CURRENCY, { [BASE_CURRENCY]: 1 }),
};

const CurrencyContext = createContext<CurrencyContextValue>(DEFAULT);

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}

const RATES_CACHE_KEY = "display-currency-rates";
const RATES_CACHE_MAX_AGE = 3600_000; // 1 hour

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Start on the base currency so the server and the first client render match
  // (localStorage is read after mount). Returning visitors see their choice
  // applied on the next paint.
  const [currency, setCurrencyState] = useState<CurrencyCode>(BASE_CURRENCY);
  const [rates, setRates] = useState<Rates>({ [BASE_CURRENCY]: 1 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (isSupportedCurrency(saved)) setCurrencyState(saved);
      } catch {
        // localStorage may be unavailable (private mode) — ignore and stay on base.
      }

      let hasFreshRates = false;
      try {
        const cached = localStorage.getItem(RATES_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { at: number; rates: Rates };
          if (parsed?.rates && Date.now() - parsed.at < RATES_CACHE_MAX_AGE) {
            setRates({ [BASE_CURRENCY]: 1, ...parsed.rates });
            setReady(true);
            hasFreshRates = true;
          }
        }
      } catch {}

      if (hasFreshRates) return;

      fetch("/api/exchange-rates")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { rates?: Rates } | null) => {
          if (cancelled || !data?.rates) return;
          setRates({ [BASE_CURRENCY]: 1, ...data.rates });
          try {
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ at: Date.now(), rates: data.rates }));
          } catch {}
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Ignore: the choice just won't persist across visits.
    }
  }, []);

  const format = useCallback(
    (inrAmount: number) => formatInCurrency(inrAmount, currency, rates),
    [currency, rates]
  );
  const formatParts = useCallback(
    (inrAmount: number) => formatInCurrencyParts(inrAmount, currency, rates),
    [currency, rates]
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      setCurrency,
      rates,
      ready,
      format,
      formatParts,
    }),
    [currency, setCurrency, rates, ready, format, formatParts],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}
