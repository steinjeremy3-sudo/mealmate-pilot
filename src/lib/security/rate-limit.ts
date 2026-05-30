/**
 * Best-effort in-memory rate limiter.
 *
 * This is a fixed-window counter held in a module-level Map. On Vercel's
 * serverless runtime each warm instance keeps its own Map, so this throttles
 * bursts hitting a single instance rather than a distributed flood — it is a
 * first line of spam defense, NOT a hard guarantee. When a shared store is
 * provisioned (Upstash is deferred — see the launch-prep notes), swap the body
 * of `rateLimit` for a Redis-backed window and keep the signature.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so the Map can't grow without bound on a long-lived
// instance. Runs only when the Map gets large, and only sweeps expired keys.
const MAX_TRACKED_KEYS = 10_000

function pruneExpired(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

export type RateLimitResult = { ok: boolean; retryAfterMs: number }

/**
 * Record a hit against `key` and report whether it is within `limit` hits per
 * `windowMs`. The first hit in a window is always allowed; the window resets
 * `windowMs` after that first hit.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now()
  pruneExpired(now)

  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now }
  }

  existing.count += 1
  return { ok: true, retryAfterMs: existing.resetAt - now }
}

/**
 * Pull the best available client IP from request headers. Returns `'unknown'`
 * when no forwarding header is present (e.g. local dev) — callers should treat
 * `'unknown'` as a shared bucket, which is acceptable for coarse spam limits.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
