/**
 * In-memory sliding-window rate limiter.
 * Keyed by arbitrary string (e.g. `chat:${userId}`, `distill:${userId}`).
 * Safe for single-process deployments (Railway, Vercel serverless with sticky routing).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the window resets — only present when allowed=false */
  retryAfterMs?: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Extract client IP from request headers (works behind Railway / Nginx / Cloudflare proxies).
 * Falls back to a constant so rate limiting degrades gracefully rather than failing open.
 */
export function getClientIp(req: Request): string {
  const headers = req instanceof Request ? req.headers : (req as { headers: Headers }).headers;
  return (
    headers.get("cf-connecting-ip") ??      // Cloudflare
    headers.get("x-real-ip") ??             // Nginx
    headers.get("x-forwarded-for")?.split(",")[0].trim() ?? // Proxies (first hop)
    "unknown"
  );
}

// Purge expired entries every minute to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 60_000).unref?.();
