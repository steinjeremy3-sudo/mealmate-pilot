import { describe, it, expect } from 'vitest'

import { rateLimit, clientIpFromHeaders } from '@/lib/security/rate-limit'

describe('rateLimit', () => {
  it('allows hits up to the limit, then blocks within the window', () => {
    const key = `test-block-${Math.random()}`
    const opts = { limit: 3, windowMs: 60_000 }

    expect(rateLimit(key, opts).ok).toBe(true)
    expect(rateLimit(key, opts).ok).toBe(true)
    expect(rateLimit(key, opts).ok).toBe(true)

    const fourth = rateLimit(key, opts)
    expect(fourth.ok).toBe(false)
    expect(fourth.retryAfterMs).toBeGreaterThan(0)
  })

  it('tracks separate keys independently', () => {
    const a = `test-a-${Math.random()}`
    const b = `test-b-${Math.random()}`
    const opts = { limit: 1, windowMs: 60_000 }

    expect(rateLimit(a, opts).ok).toBe(true)
    expect(rateLimit(a, opts).ok).toBe(false)
    // b is untouched by a's exhaustion.
    expect(rateLimit(b, opts).ok).toBe(true)
  })

  it('resets after the window elapses', () => {
    const key = `test-reset-${Math.random()}`
    // A zero-length window means the next call is always in a fresh window.
    expect(rateLimit(key, { limit: 1, windowMs: 0 }).ok).toBe(true)
    expect(rateLimit(key, { limit: 1, windowMs: 0 }).ok).toBe(true)
  })
})

describe('clientIpFromHeaders', () => {
  it('takes the first IP from x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })
    expect(clientIpFromHeaders(h)).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.4' })
    expect(clientIpFromHeaders(h)).toBe('198.51.100.4')
  })

  it('returns "unknown" when no forwarding header is present', () => {
    expect(clientIpFromHeaders(new Headers())).toBe('unknown')
  })
})
