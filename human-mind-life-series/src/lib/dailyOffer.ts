/**
 * DAILY OFFER CLOCK — the one countdown used everywhere.
 *
 * The offer (Individual Ebook: original price → discounted price, from
 * src/config/packages.ts) runs every day and never expires: each day's
 * countdown ends at 11:59:59 PM India Standard Time, and at 12:00 AM IST a
 * fresh day's countdown starts automatically.
 *
 * Nothing is stored: the remaining time is always "next IST midnight − now",
 * so refreshing, reopening the browser or switching pages can't reset it, and
 * every page shows the same time.
 *
 * Safe for the browser: no secrets, no server-only code.
 */
export const OFFER_TIME_ZONE = "Asia/Kolkata";

/** IST is UTC+05:30 all year round (India has no daylight-saving time). */
const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** Milliseconds from `now` until the next 12:00:00 AM IST (1 … 86,400,000). */
export function msUntilNextIstMidnight(now: number = Date.now()): number {
  const sinceIstMidnight = (((now + IST_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  return DAY_MS - sinceIstMidnight;
}

export type Countdown = { hours: number; minutes: number; seconds: number };

/**
 * Time left in today's offer, counting down to 11:59:59 PM IST:
 * 12:00:00 AM → 23:59:59 · 11:59:58 PM → 00:00:01 · 11:59:59 PM → 00:00:00,
 * then the next second is 12:00 AM and it starts again at 23:59:59.
 */
export function offerCountdown(now: number = Date.now()): Countdown {
  const totalSeconds = Math.floor((msUntilNextIstMidnight(now) - 1) / 1000);
  return { hours: Math.floor(totalSeconds / 3600), minutes: Math.floor((totalSeconds % 3600) / 60), seconds: totalSeconds % 60 };
}

/** The IST calendar date (YYYY-MM-DD) the offer is currently running for. */
export function offerDay(now: number = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}
