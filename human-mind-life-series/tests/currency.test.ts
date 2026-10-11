import { describe, expect, it } from "vitest";
import { convertFromBase, formatInCurrency } from "@/lib/currency";
import { isSupportedCurrency } from "@/config/currencies";

describe("Currency: display-only conversion from the INR base", () => {
  const rates = { INR: 1, USD: 0.012, EUR: 0.011, GBP: 0.0095 };

  it("converts an INR amount with the given rate", () => {
    expect(convertFromBase(299, 0.012)).toBeCloseTo(3.588, 5);
    expect(convertFromBase(0, 0.012)).toBe(0);
  });

  it("formats INR exactly as before — ₹, no decimals, grouped in en-IN", () => {
    expect(formatInCurrency(299, "INR", rates)).toBe("₹299");
    expect(formatInCurrency(999, "INR", rates)).toBe("₹999");
    expect(formatInCurrency(100000, "INR", rates)).toBe("₹1,00,000");
  });

  it("formats a chosen currency with its own symbol and 2 decimals", () => {
    expect(formatInCurrency(299, "USD", rates)).toBe("$3.59");
    expect(formatInCurrency(599, "USD", rates)).toBe("$7.19");
    expect(formatInCurrency(999, "GBP", rates)).toBe("£9.49");
  });

  it("falls back to INR when the rate is missing, zero or not finite — never ₹0 or NaN", () => {
    expect(formatInCurrency(299, "USD", { INR: 1 })).toBe("₹299");
    expect(formatInCurrency(299, "USD", { INR: 1, USD: 0 })).toBe("₹299");
    expect(formatInCurrency(299, "USD", { INR: 1, USD: Number.NaN })).toBe("₹299");
  });

  it("only recognises currencies that are actually offered", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("INR")).toBe(true);
    expect(isSupportedCurrency("XYZ")).toBe(false);
    expect(isSupportedCurrency(null)).toBe(false);
    expect(isSupportedCurrency(123)).toBe(false);
  });
});
