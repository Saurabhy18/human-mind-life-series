import { NextResponse } from "next/server";
import { BASE_CURRENCY, CURRENCY_CODES } from "@/config/currencies";
import type { Rates } from "@/lib/currency";

export const runtime = "nodejs";
// Revalidate the upstream rates hourly; the browser is told the same below.
export const revalidate = 3600;

/**
 * Live exchange rates, fetched SERVER-SIDE so the strict browser CSP
 * (connect-src 'self') never needs to allow a third-party rates host, and the
 * upstream call is cached and shared across all visitors.
 *
 * Provider: open.er-api.com — free, no API key, base INR.
 * Response shape: { result, base_code, rates: { USD: 0.0119, ... }, time_last_update_unix }
 */
const PROVIDER = `https://open.er-api.com/v6/latest/${BASE_CURRENCY}`;

/** INR→INR is always 1; included so the base always has a usable rate. */
function baseOnly(): Rates {
  return { [BASE_CURRENCY]: 1 };
}

export async function GET() {
  try {
    const res = await fetch(PROVIDER, {
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`rates provider ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_unix?: number };
    if (data.result !== "success" || !data.rates) throw new Error("rates provider returned no rates");

    // Keep only the currencies we actually offer, and always include the base.
    const rates: Rates = baseOnly();
    for (const code of CURRENCY_CODES) {
      const r = data.rates[code];
      if (typeof r === "number" && Number.isFinite(r) && r > 0) rates[code] = r;
    }

    return NextResponse.json(
      { base: BASE_CURRENCY, rates, fetchedAt: (data.time_last_update_unix ?? Math.floor(Date.now() / 1000)) * 1000, stale: false },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    // Never fail the page: fall back to base-only rates so prices simply stay in INR.
    return NextResponse.json(
      { base: BASE_CURRENCY, rates: baseOnly(), fetchedAt: Date.now(), stale: true },
      { status: 200, headers: { "Cache-Control": "public, max-age=300" } },
    );
  }
}
