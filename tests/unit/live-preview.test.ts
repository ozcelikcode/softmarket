import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXIT_PREVIEW_ROUTE, LIVE_PREVIEW_BREAKPOINTS, LIVE_PREVIEW_COLLECTIONS, PREVIEW_ROUTE,
  livePreviewURL, previewOrigin, previewTargetPath, safePreviewRedirect,
} from '@/lib/preview-url'

/*
 * F8 pure rules: redirect allow-list (open-redirect vectors), preview target paths per collection/locale,
 * the iframe origin, config wiring (collections, breakpoints, pages autosave 2 s) and the message-origin
 * check RefreshRouteOnSave relies on. Route/DB behaviour: live-preview-db.test.ts.
 */

afterEach(() => { vi.unstubAllEnvs() })

// `@payloadcms/live-preview` is a transitive dependency of `@payloadcms/live-preview-react` (pnpm: not hoisted).
type LivePreviewCore = {
  isDocumentEvent: (event: MessageEvent, serverURL: string) => boolean
  ready: (args: { serverURL: string }) => void
}
const core = async () => import(pathToFileURL(join(
  realpathSync(join(process.cwd(), 'node_modules/@payloadcms/live-preview-react')), '../live-preview/dist/index.js',
)).href) as Promise<LivePreviewCore>

describe('safePreviewRedirect', () => {
  it('accepts locale-prefixed same-origin paths only', () => {
    for (const ok of ['/tr', '/en', '/tr/', '/tr/urunler/erp/bulut', '/en/products/erp/cloud', '/tr/yasal/kvkk', '/tr/kampanya-2026'])
      expect(safePreviewRedirect(ok), ok).toBe(ok.length > 3 ? ok.replace(/\/$/, '') : ok)
  })

  it.each([
    'https://evil.example/tr', 'http://127.0.0.1:3100/tr', '//evil.example', '//evil.example/tr', '///evil.example',
    '/\\evil.example', '\\\\evil.example', '/tr\\..\\admin', '/%2F%2Fevil.example', '/tr/%2F%2Fevil.example',
    '/%5C%5Cevil.example', '/tr%2F..%2Fadmin', '/tr/%0d%0aSet-Cookie:x=y', '/tr/\r\nLocation: //evil', 'javascript:alert(1)',
    'data:text/html,x', '/tr/../admin', '/tr/./x', '/admin', '/api/users', '/', '', ' /tr', '/tr ', '/tr?x=1', '/tr#x',
    '/de/x', '/tr/x y', '/tr/ürün', `/tr/${'a'.repeat(600)}`, '/tr//evil.example', '/tr/.hidden', '/tr/-x',
  ])('rejects %j', (value) => {
    expect(safePreviewRedirect(value)).toBeNull()
  })

  it('rejects non-strings', () => {
    for (const value of [null, undefined, 1, ['/tr'], { toString: () => '/tr' }]) expect(safePreviewRedirect(value)).toBeNull()
  })
})

describe('previewTargetPath', () => {
  const lookup = { homePageId: vi.fn(async () => 7), familySlug: vi.fn(async (id: number) => (id === 3 ? 'erp' : null)) }

  it('maps each live-preview collection to its canonical path', async () => {
    expect(await previewTargetPath('pages', { id: 7, slug: 'anasayfa', pageType: 'standard' }, lookup)).toBe('/')
    expect(await previewTargetPath('pages', { id: 8, slug: 'home' }, lookup)).toBe('/')
    expect(await previewTargetPath('pages', { id: 9, slug: 'kampanya', pageType: 'landing' }, lookup)).toBe('/kampanya')
    expect(await previewTargetPath('pages', { id: 10, slug: 'urunler', systemKey: 'products' }, lookup)).toBe('/urunler')
    expect(await previewTargetPath('pages', { id: 11, slug: 'kvkk', pageType: 'legal' }, lookup)).toBe('/yasal/kvkk')
    expect(await previewTargetPath('pages', { id: 12, slug: 'sablon', pageType: 'template' }, lookup)).toBeNull()
    expect(await previewTargetPath('product-families', { slug: 'erp' }, lookup)).toBe('/urunler/erp')
    expect(await previewTargetPath('products', { slug: 'bulut', family: 3 }, lookup)).toBe('/urunler/erp/bulut')
    expect(await previewTargetPath('products', { slug: 'bulut', family: { id: 4, slug: 'crm' } }, lookup)).toBe('/urunler/crm/bulut')
    expect(await previewTargetPath('products', { slug: 'bulut', family: 99 }, lookup)).toBeNull()
    expect(await previewTargetPath('solutions', { slug: 'uretim' }, lookup)).toBe('/cozumler/uretim')
    expect(await previewTargetPath('case-studies', { slug: 'acme' }, lookup)).toBe('/referanslar/acme')
    expect(await previewTargetPath('posts', { slug: 'duyuru' }, lookup)).toBe('/haberler/duyuru')
    expect(await previewTargetPath('careers', { slug: 'x' }, lookup)).toBeNull()
    // A slug that is not slug-shaped never becomes a URL.
    expect(await previewTargetPath('posts', { slug: '//evil.example' }, lookup)).toBeNull()
    expect(await previewTargetPath('posts', {}, lookup)).toBeNull()
  })
})

describe('previewOrigin / livePreviewURL', () => {
  const req = (host: string, home: number | null = null) => ({
    host, headers: new Headers({ host }),
    payload: {
      findGlobal: vi.fn(async () => ({ homePage: home })),
      findByID: vi.fn(async () => ({ slug: 'erp' })),
    },
  }) as never

  it('uses the public origin in production and the loopback admin host locally', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://www.example.com')
    expect(previewOrigin(req('evil.example'))).toBe('https://www.example.com')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3100')
    expect(previewOrigin(req('127.0.0.1:3200'))).toBe('http://127.0.0.1:3200')
    expect(previewOrigin(req('localhost:3100'))).toBe('http://localhost:3100')
    // A spoofed non-loopback Host header never becomes the iframe origin.
    expect(previewOrigin(req('evil.example'))).toBe('http://127.0.0.1:3100')
    expect(previewOrigin(req('127.0.0.1.evil.example:80'))).toBe('http://127.0.0.1:3100')
  })

  it('builds /api/preview URLs with a localized, validated redirect', async () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://localhost:3100')
    const r = req('127.0.0.1:3200', 7)
    const url = (collection: string, data: object, code: string) =>
      livePreviewURL({ collectionConfig: { slug: collection }, data: data as never, locale: { code }, req: r })
    expect(await url('pages', { id: 7, slug: 'anasayfa' }, 'tr')).toBe('http://127.0.0.1:3200/api/preview?redirect=%2Ftr')
    expect(await url('pages', { id: 7, slug: 'home-en' }, 'en')).toBe('http://127.0.0.1:3200/api/preview?redirect=%2Fen')
    expect(await url('products', { slug: 'cloud', family: 3 }, 'en')).toBe('http://127.0.0.1:3200/api/preview?redirect=%2Fen%2Fproducts%2Ferp%2Fcloud')
    expect(await url('posts', { slug: 'duyuru' }, 'tr')).toBe('http://127.0.0.1:3200/api/preview?redirect=%2Ftr%2Fhaberler%2Fduyuru')
    expect(await url('case-studies', { slug: 'acme' }, 'en')).toBe('http://127.0.0.1:3200/api/preview?redirect=%2Fen%2Fcustomers%2Facme')
    expect(await url('pages', { id: 2, slug: 'sablon', pageType: 'template' }, 'tr')).toBeNull()
    expect(PREVIEW_ROUTE).toBe('/api/preview')
    expect(EXIT_PREVIEW_ROUTE).toBe('/api/exit-preview')
  })
})

describe('config wiring', () => {
  it('enables live preview for the six collections with mobile/tablet/desktop breakpoints and pages/products autosave', async () => {
    vi.stubEnv('PAYLOAD_SECRET', 'test-secret-long-enough-for-payload')
    const config = await (await import('../../src/payload.config')).default
    expect(config.admin.livePreview?.collections).toEqual([...LIVE_PREVIEW_COLLECTIONS])
    expect(config.admin.livePreview?.url).toBe(livePreviewURL)
    expect(LIVE_PREVIEW_BREAKPOINTS.map((b) => [b.name, b.width])).toEqual([['mobile', 390], ['tablet', 768], ['desktop', 1440]])
    const versions = (slug: string) => config.collections.find((c) => c.slug === slug)?.versions
    expect(versions('pages')).toMatchObject({ drafts: { autosave: { interval: 2000 } } })
    // V2: products autosave too (bound-block composition + Live Preview; plan-visual-editor §V2-S).
    expect(versions('products')).toMatchObject({ drafts: { autosave: { interval: 2000 } } })
    // Other drafted collections keep manual drafts (SQLite write load; plan §2.5).
    for (const slug of ['solutions', 'case-studies', 'posts'])
      expect(versions(slug)).toMatchObject({ drafts: { autosave: false } })
  }, 60000)
})

describe('RefreshRouteOnSave message contract', () => {
  const event = (origin: string, type = 'payload-document-event') => ({ origin, data: { type } }) as MessageEvent

  it('refreshes only for same-origin Payload document events', async () => {
    const { isDocumentEvent } = await core()
    expect(isDocumentEvent(event('http://127.0.0.1:3200'), 'http://127.0.0.1:3200')).toBe(true)
    expect(isDocumentEvent(event('https://evil.example'), 'http://127.0.0.1:3200')).toBe(false)
    expect(isDocumentEvent(event('http://127.0.0.1:3200', 'payload-live-preview'), 'http://127.0.0.1:3200')).toBe(false)
    expect(isDocumentEvent({ origin: 'http://127.0.0.1:3200', data: 'payload-document-event' } as MessageEvent, 'http://127.0.0.1:3200')).toBe(false)
  })

  it('announces readiness to the parent window with the own origin as target', async () => {
    const { ready } = await core()
    const postMessage = vi.fn()
    vi.stubGlobal('window', { parent: { postMessage }, opener: null })
    try {
      ready({ serverURL: 'http://127.0.0.1:3200' })
      expect(postMessage).toHaveBeenCalledWith({ type: 'payload-live-preview', ready: true }, 'http://127.0.0.1:3200')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('frontend route config', () => {
  it('no public route forces static rendering (it would silently disable draft reads)', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const root = join(process.cwd(), 'src/app/(frontend)')
    const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => /(?:page|layout)\.tsx$/.test(f))
    expect(files.length).toBeGreaterThan(20)
    for (const file of files)
      expect(readFileSync(join(root, file), 'utf8'), file).not.toMatch(/export const dynamic = ['"](?:error|force-static)['"]/)
  })
})

describe('middleware', () => {
  it('marks draft-mode requests private/no-store even on ISR routes', async () => {
    const { default: middleware } = await import('../../src/middleware')
    const res = (cookie?: string) => middleware(new NextRequest('http://127.0.0.1:3200/tr/haberler/duyuru', {
      headers: cookie ? { cookie } : {},
    }))
    expect(res('__prerender_bypass=abc').headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(res().headers.get('cache-control')).toBeNull()
  })
})
