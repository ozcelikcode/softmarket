import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

import { RichContent } from '@/components/blocks/rich-text'
import { mediaOf } from '@/lib/content'
import { editionHref } from '@/components/product/edition-card'
import { MAX_PAGE, parsePage } from '@/lib/page-utils'
import { buildMetadata, siteUrl } from '@/lib/seo'
import { referencePath } from '@/lib/site'

const text = (value: string) => ({ type: 'text', text: value, format: 0, version: 1 })
const render = (...children: unknown[]) => renderToStaticMarkup(createElement(RichContent, {
  locale: 'en', data: { root: { type: 'root', children } },
}))

afterEach(() => vi.unstubAllEnvs())

describe('CMS rendering boundary', () => {
  it.each(['heading', 'list'])('does not let a %s node choose executable HTML tags', (type) => {
    const html = render({ type, tag: 'script', children: [text('window.__auditXss=1')] })
    expect(html).not.toContain('<script')
  })

  it('keeps page headings below the page h1', () => {
    expect(render({ type: 'heading', tag: 'h1', children: [text('Section')] })).toContain('<h2>Section</h2>')
  })

  it('rejects unsafe upload URLs and unpopulated/protected upload relations', () => {
    const html = render({ type: 'upload', relationTo: 'media', value: {
      url: 'data:text/html,<script>alert(1)</script>', filename: 'unsafe.html', mimeType: 'text/html',
    } }, { type: 'upload', relationTo: 'media', value: 42 })
    expect(html).not.toContain('data:')
    expect(html).not.toContain('unsafe.html')
  })

  it('validates link and autolink schemes while preserving localized safe links', () => {
    const html = render(...['link', 'autolink'].map((type) => ({
      type, fields: { url: 'javascript:alert(1)' }, children: [text('unsafe')],
    })), { type: 'link', fields: { url: '/urunler', newTab: true }, children: [text('Products')] })
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="/en/products"')
    expect(html).toContain('noopener noreferrer')
  })

  it('ignores malformed rich text roots', () => {
    expect(() => renderToStaticMarkup(createElement(RichContent, {
      locale: 'tr', data: { root: { children: 'invalid' } },
    }))).not.toThrow()
    expect(() => render(null, false, 1, {})).not.toThrow()
    expect(() => render({ type: 'text', text: { invalid: true } })).not.toThrow()
  })

  it('rejects media with non-resource URL schemes', () => {
    expect(mediaOf({ url: 'javascript:alert(1)' })).toBeNull()
    expect(mediaOf({ url: 'data:text/html,test' })).toBeNull()
    expect(mediaOf({ url: '/api/media/file/public.png', alt: 'Public' })?.alt).toBe('Public')
  })
})

describe('public URLs', () => {
  it('routes every edition to a quote with encoded identifiers', () => {
    expect(editionHref({ sku: 'PRO-1Y' }, 'ürün & demo'))
      .toBe('/teklif-iste?urun=%C3%BCr%C3%BCn%20%26%20demo&surum=PRO-1Y')
  })
  it('uses the actual local development port when the server URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    expect(siteUrl()).toBe('http://127.0.0.1:3100')
    expect(buildMetadata({ locale: 'en', path: '/haberler?sayfa=2' }).alternates?.canonical)
      .toBe('http://127.0.0.1:3100/en/news?sayfa=2')
  })

  it('does not build canonical URLs from invalid configured origins', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'javascript:alert(1)')
    expect(siteUrl()).toBe('http://127.0.0.1:3100')
  })

  it('resolves only pages with an implemented public route', () => {
    expect(referencePath({ relationTo: 'pages', value: { slug: 'about', pageType: 'standard' } })).toBe('/sirket/hakkimizda')
    expect(referencePath({ relationTo: 'pages', value: { slug: 'privacy', pageType: 'legal' } })).toBe('/yasal/privacy')
    expect(referencePath({ relationTo: 'pages', value: { slug: 'campaign', pageType: 'landing' } })).toBeNull()
  })
})

describe('pagination input', () => {
  it.each(['', '-1', '0', '1.5', '1e2', '0x2', '9999999999999999999999999999', ['2', '1'], String(MAX_PAGE + 1)])('rejects malformed or unbounded input %j', (value) => {
    expect(parsePage(value)).toBeNull()
  })
  it('accepts absent input and bounded decimal pages', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('2')).toBe(2)
    expect(parsePage(String(MAX_PAGE))).toBe(MAX_PAGE)
  })
})
