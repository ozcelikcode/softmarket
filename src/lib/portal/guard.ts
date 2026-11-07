import { createRateLimiter, requestIP } from '@/lib/forms/security'

type Limiter = ReturnType<typeof createRateLimiter>
const store = globalThis as typeof globalThis & { softmarketPortalLimits?: Record<string, Limiter> }
const limiters = (store.softmarketPortalLimits ??= {})
const limiter = (name: string, max: number, windowMs: number) => (limiters[name] ??= createRateLimiter(max, windowMs))

/** Server Actions are same-origin POSTs; requests without a matching Origin are refused. */
export function sameOrigin(h: Pick<Headers, 'get'>): { ok: boolean; hostname?: string } {
  const origin = h.get('origin')
  const host = h.get('host')
  if (!origin || !host) return { ok: false }
  try {
    const url = new URL(origin)
    return ['http:', 'https:'].includes(url.protocol) && url.host === host
      ? { ok: true, hostname: url.hostname }
      : { ok: false }
  } catch {
    return { ok: false }
  }
}

/** Per-IP and per-account windows. An unauthenticated proxy header never raises the IP trust level. */
export function allowAuthAttempt(h: Pick<Headers, 'get'>, account: string, scope: string, max = 10): boolean {
  const ip = requestIP(h)
  const byAccount = limiter(`${scope}:account`, max, 15 * 60_000)(account.trim().toLowerCase())
  // Missing/untrusted proxy identity shares a bounded bucket, just like the public forms.
  const byIp = limiter(`${scope}:ip`, max * 4, 10 * 60_000)(ip)
  return byAccount && byIp
}

/** Authenticated writes (tickets, replies, profile): per customer. */
export const allowCustomerAction = (customerId: number | string, scope: string, max = 20) =>
  limiter(`${scope}:customer`, max, 10 * 60_000)(String(customerId))

export { requestIP }
