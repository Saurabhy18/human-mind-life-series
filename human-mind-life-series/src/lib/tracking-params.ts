/**
 * UTM / click-ID capture (browser only).
 *
 * When a visitor arrives from an ad (e.g. ?utm_source=facebook&utm_campaign=vol1),
 * the parameters are remembered for 30 days and attached to their order, so
 * the admin dashboard shows which ad or campaign produced each sale.
 */
const KEY = "hm_attribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const URL_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;

type Attribution = Record<string, string> & { ts?: string };

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Attribution;
    if (!data.ts || Date.now() - Number(data.ts) > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl: Attribution = {};
    for (const k of URL_KEYS) {
      const v = params.get(k);
      if (v) fromUrl[k] = v.slice(0, 200);
    }
    const referrer = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : "";

    // A new ad click (last touch) replaces earlier data; otherwise keep the first visit.
    if (Object.keys(fromUrl).length > 0 || (!read() && referrer)) {
      const data: Attribution = {
        ...fromUrl,
        landing_page: window.location.pathname,
        ts: String(Date.now()),
      };
      if (referrer) data.referrer = referrer.slice(0, 200);
      localStorage.setItem(KEY, JSON.stringify(data));
    }
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

export function getAttribution(): Record<string, string> | null {
  const data = read();
  if (!data) return null;
  const { ts: _ts, ...rest } = data;
  void _ts;
  return rest;
}
