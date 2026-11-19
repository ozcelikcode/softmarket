import { draftMode } from 'next/headers'

import { isAdminOrEditorUser } from '@/access/roles'
import { safePreviewRedirect } from '@/lib/preview-url'
import { originForHost } from '@/lib/server-url'
import { getPayloadClient } from '@/lib/site'

/*
 * F8 preview gate. `GET /api/preview?redirect=/tr/...` enables Next draft mode ONLY for an authenticated staff
 * user (users collection, admin/editor). No shared secret: a token alone is never sufficient. Order:
 *   cross-site navigation -> 403, invalid redirect -> 400, no session -> 401, customer/other -> 403,
 * all without touching the draft cookie. Responses are never cached and the redirect is a relative,
 * same-origin, locale-prefixed path (src/lib/preview-url.ts).
 */

const NO_STORE = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

const deny = (status: 400 | 401 | 403, message: string) =>
  new Response(message, { status, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } })

const redirectTo = (location: string) => new Response(null, {
  status: 307, headers: { ...NO_STORE, 'Referrer-Policy': 'same-origin', Location: location },
})

/** Require evidence of a same-origin navigation, including for browsers without Fetch Metadata. */
const sameOrigin = (request: Request) => {
  const site = request.headers.get('sec-fetch-site')
  const url = new URL(request.url)
  const host = request.headers.get('host')
  const forwarded = request.headers.get('x-forwarded-proto')
  const origin = originForHost(host ?? url.host, forwarded === null ? url.protocol : `${forwarded}:`)
  const explicitOrigin = request.headers.get('origin')
  if (!origin || (explicitOrigin !== null && explicitOrigin !== origin)) return null
  if (site) return site === 'same-origin' ? origin : null
  if (explicitOrigin) return origin
  const referer = request.headers.get('referer')
  if (!referer) return null
  try {
    return new URL(referer).origin === origin ? origin : null
  } catch {
    return null
  }
}

export async function enablePreview(request: Request): Promise<Response> {
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin') return deny(403, 'Forbidden')
  const redirect = safePreviewRedirect(new URL(request.url).searchParams.get('redirect'))
  if (!redirect) return deny(400, 'Invalid redirect')
  const origin = sameOrigin(request)
  if (!origin && (request.headers.has('origin') || request.headers.has('referer'))) return deny(403, 'Forbidden')
  const authHeaders = new Headers(request.headers)
  // Browsers without Fetch Metadata can still prove same origin with the iframe Referer.
  if (!site && !authHeaders.has('origin') && origin) authHeaders.set('origin', origin)
  let user: unknown = null
  try {
    user = (await (await getPayloadClient()).auth({ headers: authHeaders })).user
  } catch {
    user = null
  }
  if (!user) return deny(401, 'Unauthorized')
  if (!isAdminOrEditorUser(user as never)) return deny(403, 'Forbidden')
  if (!origin) return deny(403, 'Forbidden')
  ;(await draftMode()).enable()
  return redirectTo(redirect)
}

/** `GET /api/exit-preview[?redirect=/tr/...]`: same-origin only. */
export async function disablePreview(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return deny(403, 'Forbidden')
  const raw = new URL(request.url).searchParams.get('redirect')
  const redirect = raw === null ? '/tr' : safePreviewRedirect(raw)
  if (!redirect) return deny(400, 'Invalid redirect')
  ;(await draftMode()).disable()
  return redirectTo(redirect)
}
