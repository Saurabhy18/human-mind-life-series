import "server-only";
import crypto from "node:crypto";

/** Best-effort client IP (set your host/proxy to forward x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

/** IPs are stored only as a salted hash, for spotting abuse — never in plain form. */
export function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET || "hm-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Rejects cross-site form posts: the browser's Origin header must match the
 * host this site is served from.
 */
export function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host") || headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
