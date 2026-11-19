import { createRateLimiter, requestIP } from '@/lib/forms/security'
import { normalizeIp, truncateIp } from '@/lib/licensing/crypto/ip'

const MINUTE_MS = 60_000

function createReturnLimits() {
  // Hash keys in memory. At capacity, keep active budgets and pool new keys into a shared overflow window.
  const byIp = createRateLimiter(60, MINUTE_MS, 10_000, true)
  return {
    ip: (headers: Pick<Headers, 'get'>) => {
      const ip = normalizeIp(requestIP(headers))
      return byIp((ip?.includes(':') ? truncateIp(ip) : ip) ?? 'unknown')
    },
    token: createRateLimiter(2, MINUTE_MS, 10_000, true),
  }
}

export const allowIyzicoReturn = createReturnLimits()
export const allowStripeReturn = createReturnLimits()
