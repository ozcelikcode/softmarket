import { serverUrl } from '@/lib/server-url'

const LOCAL_FALLBACK = 'http://127.0.0.1:3100'

/**
 * Public origin for the provider return URLs. Production uses the configured site URL; without one (local dev, the
 * isolated e2e server) the already origin-checked request origin is used, loopback hosts only.
 */
export function checkoutOrigin(h: Pick<Headers, 'get'>): string {
  const configured = serverUrl()
  if (configured !== LOCAL_FALLBACK) return configured
  try {
    const url = new URL(h.get('origin') ?? '')
    if (['127.0.0.1', 'localhost'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) return url.origin
  } catch {
    // Fall through to the configured fallback.
  }
  return configured
}
