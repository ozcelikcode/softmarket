import { NextRequest } from 'next/server'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { describe, expect, it, vi } from 'vitest'

import { buildPathnames, CANONICAL_PATHS, languageSwitchPath, localizedHref } from '@/i18n/paths'
import middleware, { config } from '@/middleware'
import { safeHref } from '@/lib/utils'

const origin = 'http://127.0.0.1:3000'

describe('frontend routing boundaries', () => {
  it.each(['/admin', '/admin/login', '/api/products', '/api/media/file/x', '/api/graphql', '/api/graphql-playground', '/graphql', '/graphql-playground', '/_next/static/x.js', '/_vercel/x', '/logo.svg'])('excludes %s from locale routing', (path) => {
    expect(unstable_doesMiddlewareMatch({config, nextConfig: {}, url: origin + path})).toBe(false)
  })

  it.each(['/tr', '/en', '/urunler?x=1', '/admin-help', '/apiary'])('matches frontend path %s at segment boundaries', (path) => {
    expect(unstable_doesMiddlewareMatch({config, nextConfig: {}, url: origin + path})).toBe(true)
  })

  it('rejects unsupported locales without nesting a locale prefix', () => {
    expect(middleware(new NextRequest(origin + '/de/x?q=1')).status).toBe(404)
  })

  it('canonicalizes repeated locale prefixes and preserves query', () => {
    const response = middleware(new NextRequest(origin + '/en/tr/en/products?q=a&q=b'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname + location.search).toBe('/en/products?q=a&q=b')
  })

  it('prefixes a locale-less URL without losing the query', () => {
    const response = middleware(new NextRequest(origin + '/urunler?q=a&q=b'))
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname + location.search).toBe('/tr/urunler?q=a&q=b')
  })
})

describe('localized links', () => {
  it('translates only static route segments and preserves query and hash', () => {
    expect(localizedHref('/urunler/destek/arama?x=1&x=2#ozellikler', 'en')).toBe('/en/products/destek/arama?x=1&x=2#ozellikler')
  })

  it('does not double-prefix already localized CMS URLs', () => {
    expect(localizedHref('/en/products/destek/arama?x=1#top', 'tr')).toBe('/tr/urunler/destek/arama?x=1#top')
    expect(localizedHref('/tr/urunler/', 'en')).toBe('/en/products')
  })

  it('has unique, reversible templates for every declared path', () => {
    const paths = buildPathnames()
    expect(new Set(Object.values(paths).map(p => p.en)).size).toBe(CANONICAL_PATHS.length)
    for (const route of CANONICAL_PATHS) {
      const concrete = route.replace(/\[[^\]]+\]/g, 'destek')
      const english = localizedHref(concrete, 'en')
      expect(localizedHref(english, 'tr')).toBe('/tr' + (concrete === '/' ? '' : concrete))
    }
  })

  it('falls back to a listing instead of reusing a locale-specific slug', () => {
    expect(languageSwitchPath('/urunler/[family]/[product]')).toBe('/urunler')
    expect(languageSwitchPath('/haberler/turkce-baslik')).toBe('/haberler')
    expect(languageSwitchPath('/destek/dokumantasyon/[product]/[slug]')).toBe('/destek/dokumantasyon')
    expect(languageSwitchPath('/bilinmeyen-sayfa')).toBe('/')
    expect(languageSwitchPath('/hesap/lisanslar')).toBe('/hesap/lisanslar')
  })
})

describe('CMS URL safety', () => {
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,test', 'vbscript:msgbox(1)', '//evil.test', '/\\evil.test', '\nhttps://example.com', 'file:///etc/passwd'])('rejects unsafe URL %j', value => {
    expect(safeHref(value)).toBeNull()
    expect(localizedHref(value, 'en')).toBe('#')
  })

  it.each(['https://example.com/a?q=1#top', 'mailto:sales@example.com', 'tel:+902120000000', '/urunler', '#top', '?q=test'])('allows URL %s', value => {
    expect(safeHref(value)).toBe(value)
  })
})

describe('CSP middleware composition', () => {
  it('preserves the numeric origin when next-intl rewrites an English route', () => {
    // Mirrors skipMiddlewareUrlNormalize from next.config.ts.
    vi.stubEnv('__NEXT_NO_MIDDLEWARE_URL_NORMALIZE', 'true')
    const response = middleware(new NextRequest('http://127.0.0.1:3100/en/products'))
    vi.unstubAllEnvs()
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://127.0.0.1:3100/en/urunler')
    expect(response.headers.get('location')).toBeNull()
  })
  it('replaces forged security headers and forwards a fresh nonce only on dynamic routes', () => {
    const request = new NextRequest('http://127.0.0.1:3100/tr/teklif-iste', { headers: {
      'x-nonce': 'attacker', 'content-security-policy': "script-src 'unsafe-inline'", 'x-sm-path': '/admin',
    } })
    const response = middleware(request)
    const policy = response.headers.get('Content-Security-Policy-Report-Only')!
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1]
    expect(nonce).toBeTruthy()
    expect(nonce).not.toBe('attacker')
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    expect(response.headers.get('x-middleware-request-x-sm-path')).toBeNull()
    expect(response.headers.get('Cache-Control')).toContain('no-store')
    const publicResponse = middleware(new NextRequest('http://127.0.0.1:3100/tr', { headers: { 'x-nonce': 'attacker' } }))
    expect(publicResponse.headers.get('x-middleware-request-x-nonce')).toBeNull()
    expect(publicResponse.headers.get('Content-Security-Policy-Report-Only')).not.toContain('nonce-')
  })
})
