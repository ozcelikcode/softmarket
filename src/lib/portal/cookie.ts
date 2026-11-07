/**
 * Portal session cookie, deliberately NOT Payload's shared `payload-token`.
 * Admin panel (users) and portal (customers) would otherwise overwrite each other's session.
 * Production uses the `__Host-` prefix (Secure, Path=/, no Domain); local HTTP cannot set Secure.
 */
export const PORTAL_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-sm_customer' : 'sm_customer'

/** Reads one cookie value from a Cookie header; no decoding beyond the JWT's URL-safe alphabet. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim()
      return /^[\w-]+\.[\w-]+\.[\w-]+$/.test(value) ? value : null
    }
  }
  return null
}
