/**
 * In-memory rate limiter (per IP, sliding window).
 *
 * Каждый вызов createRateLimit() создаёт отдельный Map —
 * разные роуты не делят лимиты между собой.
 *
 * Ограничение: в serverless каждый instance имеет свой Map.
 * Для строгого rate limiting заменить на Redis (Upstash).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
}

export function createRateLimit(options?: RateLimitOptions) {
  const windowMs = options?.windowMs ?? 60_000;
  const max = options?.max ?? 30;
  const store = new Map<string, RateLimitEntry>();

  return function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = store.get(ip);
    if (!entry || entry.resetAt < now) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}
