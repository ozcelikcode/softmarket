import { createRateLimiter, requestIP } from '@/lib/forms/security'
import { normalizeIp, truncateIp } from '@/lib/licensing/crypto/ip'
import { originForHost } from '@/lib/server-url'

type Limiter = ReturnType<typeof createRateLimiter>
const store = globalThis as typeof globalThis & { softmarketPortalLimits?: Record<string, Limiter> }
const limiters = (store.softmarketPortalLimits ??= {})
const limiter = (name: string, max: number, windowMs: number) => (limiters[name] ??= createRateLimiter(max, windowMs, 10_000, true))

/** Server Actions are same-origin POSTs; requests without a matching Origin are refused. */
export function sameOrigin(h: Pick<Headers, 'get'>): { ok: boolean; hostname?: string } {
  const origin = h.get('origin')
  const host = h.get('host')
  if (!origin || !host) return { ok: false }
  try {
    const url = new URL(origin)
    const forwarded = h.get('x-forwarded-proto')
    const protocol = forwarded === null ? url.protocol : `${forwarded}:`
    return origin === url.origin && origin === originForHost(host, protocol)
      ? { ok: true, hostname: url.hostname }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Per-IPv4/IPv6-network and per-account windows. */
export function allowAuthAttempt(h: Pick<Headers, 'get'>, account: string, scope: string, max = 10): boolean {
  const ip = normalizeIp(requestIP(h))
  const network = ip?.includes(':') ? truncateIp(ip) : ip
  // Missing/untrusted proxy identity shares a bounded bucket, just like the public forms.
  if (!limiter(`${scope}:ip`, max * 4, 10 * 60_000)(network ?? 'unknown')) return false
  return limiter(`${scope}:account`, max, 15 * 60_000)(account.trim().toLowerCase())
}

/** Authenticated writes (tickets, replies, profile): per customer. */
export const allowCustomerAction = (customerId: number | string, scope: string, max = 20) =>
  limiter(`${scope}:customer`, max, 10 * 60_000)(String(customerId))

export { requestIP }
