import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { forbiddenActionOrigin, legacySearchPath } from './lib/request-guards'

import { routing } from './i18n/routing'
import { contentSecurityPolicy, usesNonce } from './lib/csp'

const localize = createMiddleware(routing)

export default function middleware(request: NextRequest) {
  if (forbiddenActionOrigin(request.method, request.headers)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  const { pathname } = request.nextUrl
  const legacy = legacySearchPath(pathname)
  if (legacy) {
    // NextURL normalizes loopback hosts even with skipMiddlewareUrlNormalize.
    // The original request URL preserves the origin for this same-host redirect.
    const url = new URL(request.url)
    url.pathname = legacy
    return NextResponse.redirect(url, 308)
  }
  const first = pathname.split('/')[1]
  // Reject unsupported locale prefixes instead of silently nesting them under /tr.
  if (/^[a-z]{2}(?:-[a-z]{2})?$/i.test(first) && !routing.locales.includes(first as 'tr' | 'en')) {
    return new NextResponse('Not Found', { status: 404 })
  }
  const duplicate = pathname.match(/^\/(tr|en)(?:\/(?:tr|en))+(?=\/|$)/)
  if (duplicate) {
    const url = request.nextUrl.clone()
    url.pathname = `/${duplicate[1]}${pathname.slice(duplicate[0].length)}`
    return NextResponse.redirect(url)
  }
  // Preserve the original NextRequest URL/host normalization when composing
  // next-intl rewrites. Reconstructing it can proxy EN routes to localhost.
  const headers = request.headers
  // Never trust a browser-supplied nonce or CSP. Only the middleware sets these.
  headers.delete('x-nonce')
  headers.delete('Content-Security-Policy')
  headers.delete('Content-Security-Policy-Report-Only')
  if (/^\/(?:tr|en)\/(?:hesap|account)(?:\/|$)/.test(pathname)) {
    headers.set('x-sm-path', pathname + request.nextUrl.search)
  } else {
    headers.delete('x-sm-path')
  }
  const enabled = process.env.CSP_ENABLED !== 'false'
  const dynamic = usesNonce(pathname)
  const nonce = enabled && dynamic ? btoa(crypto.randomUUID()) : undefined
  const policy = contentSecurityPolicy({ nonce, development: process.env.NODE_ENV === 'development' })
  if (nonce) {
    headers.set('x-nonce', nonce)
    // Next reads this request header to nonce its own framework scripts, even
    // when the response policy is Report-Only during rollout.
    headers.set('Content-Security-Policy', policy)
  }
  const response = localize(request)
  if (enabled) response.headers.set(process.env.CSP_ENFORCE === 'true' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', policy)
  if (dynamic) response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  return response
}

export const config = {
  // Payload (/admin, /api), Next internals and files with extensions are excluded.
  matcher: ['/((?!(?:api|admin|_next|_vercel|graphql|graphql-playground)(?:/|$)|.*\\..*).*)'],
}
