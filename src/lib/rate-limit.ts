/**
 * In-memory sliding-window rate limiter.
 *
 * Works on Vercel (serverless) with the caveat that each cold-start gets its
 * own window. This is still effective because:
 *   1. A single instance handles many requests before recycling.
 *   2. Combined with Cache-Control headers, most legitimate traffic never
 *      reaches the rate limiter at all.
 */

interface SlidingWindow {
  count: number;
  start: number;
}

const ipMap = new Map<string, SlidingWindow>();

// Evict stale entries every 60s to prevent unbounded memory growth
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, window] of ipMap) {
    if (now - window.start > windowMs) {
      ipMap.delete(ip);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check whether a request from `ip` is within the rate limit.
 *
 * @param ip         Client IP (from x-forwarded-for or similar)
 * @param maxPerWindow  Maximum requests allowed per window
 * @param windowMs      Window duration in milliseconds
 */
export function rateLimit(
  ip: string,
  maxPerWindow: number = 60,
  windowMs: number = 60_000,
): RateLimitResult {
  cleanup(windowMs);

  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now - entry.start > windowMs) {
    ipMap.set(ip, { count: 1, start: now });
    return { allowed: true, remaining: maxPerWindow - 1, retryAfterSeconds: 0 };
  }

  entry.count++;

  if (entry.count > maxPerWindow) {
    const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: retryAfter };
  }

  return { allowed: true, remaining: maxPerWindow - entry.count, retryAfterSeconds: 0 };
}
