import { createHash, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

/** Fixed windows with bounded storage. Optional overflow shares one budget among untracked keys. */
export function createRateLimiter(max = 5, windowMs = 10 * 60_000, capacity = 10_000, shareOverflow = false) {
  type Window = { count: number; until: number }
  const entries = new Map<string, Window>()
  let overflow: Window | undefined
  let nextCleanup = 0
  return (key: string, now = Date.now()): boolean => {
    if (!shareOverflow || now >= nextCleanup) {
      for (const [k, value] of entries) if (value.until <= now) entries.delete(k)
      nextCleanup = now + Math.min(1000, windowMs)
    }
    const hashed = createHash('sha256').update(key).digest('hex')
    let entry = entries.get(hashed)
    if (!entry && entries.size >= capacity) {
      if (!shareOverflow) return false
      if (!overflow || overflow.until <= now) overflow = { count: 0, until: now + windowMs }
      entry = overflow
    } else if (!entry || entry.until <= now) {
      entry = { count: 0, until: now + windowMs }
      entries.set(hashed, entry)
    }
    if (entry.count >= max) return false
    entry.count++
    return true
  }
}
const globalLimiter = globalThis as typeof globalThis & {
  softmarketLeadLimit?: ReturnType<typeof createRateLimiter>
}
export const allowSubmission = (globalLimiter.softmarketLeadLimit ??= createRateLimiter())

/** Headers are trustworthy only when authenticated by our Caddy instance. */
export function requestIP(h: Pick<Headers, 'get'>, secret = process.env.FORM_PROXY_SECRET): string {
  const supplied = h.get('x-softmarket-proxy-secret') ?? ''
  if (!secret || secret.length < 32 || secret.startsWith('CHANGE_')) return 'unknown'
  const expectedHash = createHash('sha256').update(secret).digest()
  const suppliedHash = createHash('sha256').update(supplied).digest()
  if (!timingSafeEqual(expectedHash, suppliedHash)) return 'unknown'
  const raw = h.get('x-softmarket-client-ip')?.trim() ?? ''
  return isIP(raw) ? raw : 'unknown'
}
export async function verifyTurnstile(
  token: string,
  ip: string,
  options: {
    secret?: string
    production?: boolean
    hostname?: string
    fetcher?: typeof fetch
  } = {},
): Promise<boolean> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY
  const production = options.production ?? process.env.NODE_ENV === 'production'
  if (!secret || secret.startsWith('CHANGE_')) return !production
  if (!token || token.length > 2048) return false
  try {
    const response = await (options.fetcher ?? fetch)(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, response: token, ...(isIP(ip) ? { remoteip: ip } : {}) }),
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      },
    )
    if (!response.ok) return false
    const result: { success?: boolean; hostname?: string } = await response.json()
    return result.success === true && (!options.hostname || result.hostname === options.hostname)
  } catch {
    return false
  }
}
