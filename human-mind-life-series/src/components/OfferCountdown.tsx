"use client";

import { useSyncExternalStore } from "react";
import { PACKAGES, discountPercent, formatMoney } from "@/config/packages";
import { offerCountdown } from "@/lib/dailyOffer";

// ---------------------------------------------------------------- Clock --
// One shared clock for every countdown on the page: ticks on each second and
// re-syncs when a phone/tab wakes up. The time always comes from the device
// clock (see src/lib/dailyOffer.ts), so nothing can drift or be reset.

let now = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(tick, 1000 - (now % 1000) + 5);
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", onVisible);
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

/** 0 on the server and during hydration (placeholders shown), the current time afterwards. */
function useNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => 0);
}

// ----------------------------------------------------------- Component --

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Daily "50% OFF — LIMITED TIME OFFER" with a countdown to 11:59:59 PM IST.
 * Resets automatically at 12:00 AM IST and never expires. Shows nothing if the
 * Individual Ebook has no original price (src/config/packages.ts).
 *   banner  — full-width strip with the offer prices (home, books, landing pages)
 *   compact — next to a price that is already shown (book page, checkout)
 */
export function OfferCountdown({
  variant = "compact",
  tone = "light",
  scope,
  className = "",
}: {
  variant?: "banner" | "compact";
  tone?: "light" | "dark";
  /** Which books the offer covers, e.g. "Volumes 1–5" (banner only). */
  scope?: string;
  className?: string;
}) {
  const t = useNow();
  const { price, originalPrice, currency } = PACKAGES.individual;
  const off = discountPercent(price, originalPrice);
  if (!off || !originalPrice) return null;

  const c = t ? offerCountdown(t) : null;
  const dark = tone === "dark";
  const units = [
    { label: "Hours", value: c?.hours },
    { label: "Minutes", value: c?.minutes },
    { label: "Seconds", value: c?.seconds },
  ];

  const title = (
    <p className={`font-sans text-xs font-bold tracking-[0.16em] uppercase sm:text-[0.8rem] ${dark ? "text-white" : "text-ink"}`}>
      <span className={dark ? "text-red-300" : "text-danger"}>{off}% OFF</span>
      <span className={dark ? "text-gold-light" : "text-gold-dark"}> — Limited Time Offer</span>
    </p>
  );

  const clock = (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-medium sm:text-sm ${dark ? "text-white/75" : "text-muted"}`}>Offer ends in:</span>
      <div
        role="timer"
        aria-label={c ? `Offer ends in ${c.hours} hours, ${c.minutes} minutes and ${c.seconds} seconds (midnight India time)` : "Offer ends at midnight India time"}
        className="flex items-start gap-1"
      >
        {units.map((u, i) => (
          <div key={u.label} className="flex items-start gap-1">
            {i > 0 && <span className={`pt-1 font-semibold ${variant === "banner" ? "text-lg" : "text-base"} ${dark ? "text-white/50" : "text-muted/70"}`} aria-hidden="true">:</span>}
            <span className="flex flex-col items-center" aria-hidden="true">
              <span
                className={`min-w-[2.4ch] rounded-lg border text-center font-sans font-semibold tabular-nums ${variant === "banner" ? "px-2 py-1 text-lg sm:text-xl" : "px-1.5 py-0.5 text-base"} ${
                  dark ? "border-white/15 bg-white/10 text-white" : "border-line bg-white text-ink"
                }`}
              >
                {u.value === undefined ? "--" : pad(u.value)}
              </span>
              <span className={`mt-1 text-[0.6rem] tracking-wide uppercase ${dark ? "text-white/55" : "text-muted"}`}>{u.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (variant === "compact") {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border px-4 py-3 ${dark ? "border-white/15 bg-white/[0.06]" : "border-gold/30 bg-cream/60"} ${className}`}>
        {title}
        {clock}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${dark ? "border-white/15 bg-white/[0.06]" : "border-gold/30 bg-cream/60"} ${className}`}>
      <div>
        {title}
        <p className={`mt-1.5 text-sm ${dark ? "text-white/75" : "text-ink/80"}`}>
          {scope ? `${scope}: ` : ""}
          <s className={dark ? "text-white/55" : "text-muted"}>{formatMoney(originalPrice, currency)}</s>{" "}
          <strong className={`font-serif text-lg ${dark ? "text-white" : "text-ink"}`}>{formatMoney(price, currency)}</strong> each
        </p>
      </div>
      {clock}
    </div>
  );
}
