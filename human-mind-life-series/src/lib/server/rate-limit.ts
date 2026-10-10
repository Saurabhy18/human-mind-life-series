import "server-only";

/**
 * Simple in-memory fixed-window rate limiter. Good for a single server
 * instance; if you run several instances, replace with a shared store (Redis).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count++;
  return { ok: bucket.count <= limit, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}
