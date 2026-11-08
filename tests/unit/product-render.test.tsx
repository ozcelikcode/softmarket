import { renderToReadableStream } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ layout: [] as unknown[] }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key, setRequestLocale: () => {} }))
vi.mock('@/components/sections/json-ld', () => ({ JsonLd: () => null }))
vi.mock('@/components/layout/set-alternates', () => ({ SetAlternates: () => null }))
vi.mock('@/lib/content', () => ({
  mediaOf: () => null,
  getProductVariants: async () => ({}),
  getProductDetail: async () => ({ family: { title: 'Family' }, product: {
    id: 1, title: 'Product', summary: 'Overview', layout: state.layout, features: [], specs: [], systemRequirements: [],
  }, editions: [], downloads: [], docSlug: null }),
}))

import ProductPage from '@/app/(frontend)/[locale]/urunler/[family]/[product]/page'

const render = async (layout: unknown[]) => {
  state.layout = layout
  const page = await ProductPage({ params: Promise.resolve({ locale: 'tr', family: 'family', product: 'product' }) })
  return new Response(await renderToReadableStream(page)).text()
}

describe('product page rendering', () => {
  it('keeps legacy extra-block motion LCP-safe, with exactly one page h1', async () => {
    const html = await render([{ blockType: 'cta', id: 'extra', heading: 'Extra', motion: { preset: 'fade' } }])
    const extra = html.slice(html.indexOf('data-block="cta"'))
    expect(extra).toContain('data-anim="slide-up"')
    expect(extra).toContain('data-anim-safe=""')
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).not.toContain('data-block="product')
  })

  it('repairs missing/hidden required sections and links tabs only to rendered sections', async () => {
    const html = await render([
      { blockType: 'productNav' },
      { blockType: 'productOverview', appearance: { hidden: true } },
      { blockType: 'hero', heading: 'Second hero' },
      { blockType: 'productEditions', appearance: { hidden: true } },
      { blockType: 'productEditions', id: 'duplicate' },
    ])
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('<h2')
    expect(html.match(/id="surumler"/g)).toHaveLength(1)
    expect(html).toContain('href="#surumler"')
    expect(html).not.toContain('href="#genel-bakis"')
    expect(html).not.toContain('href="#indirmeler"')
    expect(html).toContain('/tr/teklif-iste?urun=product')
  })
})
