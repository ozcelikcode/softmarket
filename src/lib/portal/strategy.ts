import { JWTAuthentication, type AuthStrategy } from 'payload'

import { PORTAL_COOKIE, readCookie } from './cookie'

/** Claim constraints in addition to Payload's signature and session verification. */
export function portalClaims(token: string, now = Date.now() / 1000): boolean {
  if (token.length > 4096) return false
  try {
    const [header, body] = token.split('.')
    const h = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return h.alg === 'HS256' && p.collection === 'customers' &&
      Number.isSafeInteger(p.id) && p.id > 0 && typeof p.sid === 'string' && p.sid.length > 0 &&
      typeof p.exp === 'number' && Number.isFinite(p.exp) && p.exp > now
  } catch {
    return false
  }
}

/**
 * Lets Payload (REST, protected media files) recognise the portal cookie.
 * Only tokens of the `customers` collection are accepted, so a staff token can never
 * be smuggled in through this cookie.
 */
export const portalCookieStrategy: AuthStrategy = {
  name: 'portal-cookie',
  authenticate: async ({ headers, payload, isGraphQL }) => {
    const token = readCookie(headers.get('cookie'), PORTAL_COOKIE)
    if (!token || !portalClaims(token)) return { user: null }
    const result = await JWTAuthentication({
      headers: new Headers({ Authorization: `JWT ${token}`, DisableAutologin: 'true' }),
      payload,
      isGraphQL,
      strategyName: 'portal-cookie',
    })
    if (result.user?.collection !== 'customers') return { user: null }
    // Payload 3.85 checks session membership but not the stored session expiry.
    const sid = (result.user as { _sid?: string })._sid
    const session = result.user.sessions?.find((s) => s.id === sid)
    return session && new Date(session.expiresAt).getTime() > Date.now() ? result : { user: null }
  },
}
