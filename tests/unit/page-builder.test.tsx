import type { Field, Where } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * F6 page builder (pure + mocked Payload client): reserved landing slugs vs. route folders and EN rewrites,
 * page URLs, template privacy, home resolution order (SiteSettings.homePage -> slug "home" -> fallback) and
 * the system page body (list position = `listing` block, CMS hero with i18n fallback).
 */

const client = vi.hoisted(() => ({ find: vi.fn(), findGlobal: vi.fn(), findByID: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (orig) => ({ ...(await orig<typeof import('payload')>()), getPayload: vi.fn(async () => client) }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

import { Pages, pagesRead } from '@/collections/Pages'
import { CmsPageContent, startsWithHero } from '@/components/pages/cms-page'
import { SystemBody, systemHeroText, systemMeta } from '@/components/pages/system-page'
import type { LayoutBlock } from '@/components/blocks/types'
import { CANONICAL_PATHS, languageSwitchPath, LINK_ROUTES, localizedHref, routePath, SEGMENTS_EN } from '@/i18n/paths'
import { routing } from '@/i18n/routing'
import { getHomePage, getLandingPage, getSitemapEntries, getSystemPage, type CmsPage } from '@/lib/content'
import { isLandingPage, isReservedSlug, pagePath, RESERVED_SLUGS, SYSTEM_KEYS, SYSTEM_PAGES } from '@/lib/system-pages'

const translate = (path: string) => path.split('/').map((s) => SEGMENTS_EN[s] ?? s).join('/')
const field = (name: string) => Pages.fields.find((f) => 'name' in f && f.name === name) as Field & Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  client.find.mockResolvedValue({ docs: [] })
  client.findGlobal.mockResolvedValue({})
})

describe('landing slugs never shadow a route', () => {
  it('reserves every route folder in TR and its EN rewrite target', () => {
    for (const path of CANONICAL_PATHS) {
      const tr = path.split('/')[1]
      if (!tr) continue
      expect(isReservedSlug(tr), tr).toBe(true)
      expect(isReservedSlug(translate(path).split('/')[1]), translate(path)).toBe(true)
    }
    for (const [tr, en] of Object.entries(SEGMENTS_EN)) expect([isReservedSlug(tr), isReservedSlug(en)]).toEqual([true, true])
    for (const s of ['admin', 'api', 'arama', 'tr', 'en', '_next', 'opengraph-image', 'sitemap']) expect(RESERVED_SLUGS.has(s), s).toBe(true)
    expect(isReservedSlug('home')).toBe(false)
    expect(isReservedSlug('kampanya')).toBe(false)
  })

  it('landing paths are not next-intl pathnames: EN keeps the slug, static routes still translate', () => {
    expect(Object.keys(routing.pathnames ?? {})).not.toContain('/[slug]')
    expect(localizedHref('/kampanya', 'en')).toBe('/en/kampanya')
    expect(localizedHref('/kampanya', 'tr')).toBe('/tr/kampanya')
    expect(localizedHref('/urunler', 'en')).toBe('/en/products')
    expect(localizedHref('/en/company/about', 'tr')).toBe('/tr/sirket/hakkimizda')
    // No identity across locales for CMS slugs: the switcher falls back to home unless the page sets alternates.
    expect(languageSwitchPath('/kampanya')).toBe('/')
    // Link `route` key for landing pages (added key only).
    expect(LINK_ROUTES).toContain('/[slug]')
    expect(routePath('slug', 'kampanya')).toBe('/kampanya')
    expect(routePath('slug', '../admin')).toBeNull()
  })

  it('page slug validation rejects reserved slugs only for routed (standard/landing) pages', async () => {
    const validate = (field('slug') as { validate: (v: unknown, o: unknown) => Promise<true | string> }).validate
    const opts = (data: Record<string, unknown>) => ({ data, req: { i18n: { language: 'tr' }, payload: { find: async () => ({ docs: [] }) } }, id: 1, collectionSlug: 'pages' })
    expect(await validate('urunler', opts({ pageType: 'landing' }))).toMatch(/site yolu/)
    expect(await validate('products', opts({ pageType: 'standard' }))).toMatch(/site yolu/)
    expect(await validate('hesap', opts({}))).toMatch(/site yolu/)
    expect(await validate('home', opts({ pageType: 'standard' }))).toBe(true)
    expect(await validate('kampanya', opts({ pageType: 'landing' }))).toBe(true)
    // Not routed at /<slug>: system pages, legal texts and templates may use any slug.
    expect(await validate('urunler', opts({ pageType: 'standard', systemKey: 'products' }))).toBe(true)
    expect(await validate('urunler', opts({ pageType: 'legal' }))).toBe(true)
    expect(await validate('urunler', opts({ pageType: 'template' }))).toBe(true)
  })
})

describe('page model', () => {
  it('adds template type, system keys, hero group; existing options/defaults unchanged', () => {
    expect((field('pageType').options as { value: string }[]).map((o) => o.value)).toEqual(['standard', 'legal', 'landing', 'template'])
    expect(field('pageType').defaultValue).toBe('standard')
    expect((field('systemKey').options as { value: string }[]).map((o) => o.value)).toEqual(SYSTEM_KEYS)
    expect(field('systemKey')).toMatchObject({ unique: true, index: true })
    expect(Object.values(SYSTEM_PAGES).every((p) => (CANONICAL_PATHS as readonly string[]).includes(p))).toBe(true)
  })

  it('templates are never public: anonymous read excludes them (NULL-safe), staff read all', () => {
    expect(pagesRead({ req: { user: { collection: 'users', roles: ['editor'] } } } as never)).toBe(true)
    const where = pagesRead({ req: { user: null } } as never) as Where
    expect(where).toEqual({ and: [
      { _status: { equals: 'published' } },
      { or: [{ pageType: { not_equals: 'template' } }, { pageType: { exists: false } }] },
    ] })
    expect(pagesRead({ req: { user: { collection: 'customers' } } } as never)).toEqual(where)
  })

  it('page URLs: legal, system route, home, landing; templates and reserved slugs have none', () => {
    expect(pagePath({ slug: 'kvkk', pageType: 'legal' })).toBe('/yasal/kvkk')
    expect(pagePath({ slug: 'x', pageType: 'standard', systemKey: 'customers' })).toBe('/referanslar')
    expect(pagePath({ slug: 'home', pageType: 'standard' })).toBe('/')
    expect(pagePath({ slug: 'kampanya', pageType: 'landing' })).toBe('/kampanya')
    expect(pagePath({ slug: 'kampanya', pageType: 'template' })).toBeNull()
    expect(pagePath({ slug: 'destek', pageType: 'landing' })).toBeNull()
    expect(isLandingPage({ slug: 'kampanya', pageType: 'landing', systemKey: 'news' })).toBe(false)
  })
})

describe('home resolution order', () => {
  const doc = (id: number, slug: string) => ({ id, slug, title: slug, layout: [] })

  it('SiteSettings.homePage first, then slug "home"; one anonymous published-only query', async () => {
    client.findGlobal.mockResolvedValue({ homePage: 7 })
    client.find.mockResolvedValue({ docs: [doc(3, 'home'), doc(7, 'anasayfa')] })
    expect((await getHomePage('tr'))?.id).toBe(7)
    const [options] = client.find.mock.calls[0]
    expect(options).toMatchObject({ collection: 'pages', overrideAccess: false, user: null, draft: false })
    expect(JSON.stringify(options.where)).toContain('"id":{"equals":7}')
    expect(JSON.stringify(options.where)).toContain('"slug":{"equals":"home"}')
    expect(JSON.stringify(options.where)).toContain('"not_in":["legal","template"]')
  })

  it('falls back to slug "home" when the configured page is not readable (draft/unpublished)', async () => {
    client.findGlobal.mockResolvedValue({ homePage: 7 })
    client.find.mockResolvedValue({ docs: [doc(3, 'home')] })
    expect((await getHomePage('en'))?.id).toBe(3)
  })

  it('no CMS home page -> null (built-in fallback home renders)', async () => {
    client.findGlobal.mockResolvedValue({ homePage: null })
    client.find.mockResolvedValue({ docs: [] })
    expect(await getHomePage('tr')).toBeNull()
    expect(JSON.stringify(client.find.mock.calls[0][0].where)).not.toContain('"id"')
  })

  it('system and landing loaders are anonymous; landing rejects reserved/home slugs without querying', async () => {
    await getSystemPage('tr', 'news')
    expect(client.find.mock.calls[0][0]).toMatchObject({ overrideAccess: false, user: null, draft: false, where: { and: [{ systemKey: { equals: 'news' } }, { pageType: { not_equals: 'template' } }] } })
    client.find.mockClear()
    expect(await getLandingPage('tr', 'urunler')).toBeNull()
    expect(await getLandingPage('tr', 'home')).toBeNull()
    expect(client.find).not.toHaveBeenCalled()
    client.find.mockResolvedValue({ docs: [{ id: 9, slug: 'kampanya', pageType: 'landing', systemKey: null }] })
    expect((await getLandingPage('tr', 'kampanya'))?.id).toBe(9)
  })

  it('sitemap: landing pages per locale; templates, system pages, home and reserved slugs excluded', async () => {
    client.find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'pages' ? [
        { id: 9, slug: { tr: 'kampanya', en: 'campaign' }, pageType: 'landing', updatedAt: '2026-11-07' },
        { id: 10, slug: { tr: 'ana-sayfa', en: 'front-page' }, pageType: 'landing' },
        { slug: { tr: 'kvkk' }, pageType: 'legal' },
        { slug: { tr: 'home', en: 'home' }, pageType: 'standard' },
        { slug: { tr: 'urunler', en: 'products' }, pageType: 'standard', systemKey: 'products' },
        { slug: { tr: 'destek' }, pageType: 'landing' },
      ] : [],
    }))
    client.findGlobal.mockResolvedValue({ homePage: 10 })
    const paths = (await getSitemapEntries()).map((e) => e.paths)
    expect(paths).toEqual([{ tr: '/yasal/kvkk' }, { tr: '/kampanya', en: '/campaign' }])
  })
})

describe('system page body and CMS page top', () => {
  const page = (layout: unknown[], hero: Record<string, unknown> = {}) => ({ id: 1, title: 'T', layout, hero } as unknown as CmsPage)
  const blocks = (html: string) => [...html.matchAll(/data-block="([a-zA-Z]+)"/g)].map((m) => m[1])
  const list = <div className="the-list">LIST</div>

  it('no record: the pre-F6 list section (light, md) and the route fallback', () => {
    const html = renderToStaticMarkup(<SystemBody locale="tr" page={null} listing={list} fallback={<aside>FB</aside>} />)
    expect(html).toBe('<section data-theme="light" class="relative w-full bg-bg text-text py-16 sm:py-24" data-block="listing"><div class="the-list">LIST</div></section><aside>FB</aside>')
  })

  it('the list is a movable block: placed by `listing`, first when absent, gone when hidden', () => {
    const spacer = { blockType: 'spacer', id: 's' }
    const divider = { blockType: 'divider', id: 'd' }
    expect(blocks(renderToStaticMarkup(<SystemBody locale="tr" page={page([spacer, { blockType: 'listing', id: 'l' }, divider])} listing={list} />)))
      .toEqual(['spacer', 'listing', 'divider'])
    expect(blocks(renderToStaticMarkup(<SystemBody locale="tr" page={page([spacer, divider])} listing={list} fallback={<aside>FB</aside>} />)))
      .toEqual(['listing', 'spacer', 'divider'])
    const hidden = renderToStaticMarkup(<SystemBody locale="tr" page={page([{ blockType: 'listing', id: 'l', appearance: { hidden: true } }, spacer])} listing={list} />)
    expect(blocks(hidden)).toEqual(['spacer'])
    expect(hidden).not.toContain('LIST')
    const styled = renderToStaticMarkup(<SystemBody locale="tr" page={page([{ blockType: 'listing', id: 'l', appearance: { theme: 'dark', spacing: 'lg', anchor: 'liste', separator: 'top' } }])} listing={list} />)
    expect(styled).toContain('<section data-theme="dark" class="relative w-full bg-bg text-text py-24 sm:py-32 scroll-mt-24 border-t border-border" id="liste" data-block="listing">')
  })

  it('hero copy and SEO: CMS value, else i18n default (empty/placeholder counts as empty)', () => {
    const fallback = { title: 'Ürünler', lead: 'Lead' }
    expect(systemHeroText(null, fallback)).toEqual({ title: 'Ürünler', lead: 'Lead', eyebrow: undefined })
    expect(systemHeroText(page([], { title: '  ', lead: '[AÇIKLAMA]' }), fallback)).toMatchObject({ title: 'Ürünler', lead: 'Lead' })
    expect(systemHeroText(page([], { title: 'Katalog', eyebrow: 'Ürünler' }), fallback)).toMatchObject({ title: 'Katalog', eyebrow: 'Ürünler', lead: 'Lead' })
    expect(systemMeta({ ...page([], { title: 'Katalog' }), meta: { title: 'SEO', description: '' } } as CmsPage, fallback)).toEqual({ title: 'SEO', description: 'Lead' })
  })

  it('CMS page top: a leading hero is the single h1; otherwise a PageHero with the page title', () => {
    const hero = { blockType: 'hero', id: 'h', heading: 'Merhaba', variant: 'centered' } as LayoutBlock
    const withHero = renderToStaticMarkup(<CmsPageContent locale="tr" crumbLabel="bc" page={page([{ blockType: 'listing', id: 'l' }, hero])} />)
    expect(withHero.match(/<h1/g)).toHaveLength(1)
    expect(withHero).toMatch(/<h1[^>]*>Merhaba<\/h1>/)
    expect(withHero).toContain('pt-40 sm:pt-48')
    const plain = renderToStaticMarkup(<CmsPageContent locale="tr" crumbLabel="bc" page={page([{ blockType: 'spacer', id: 's' }, hero])} />)
    expect(plain.match(/<h1/g)).toHaveLength(1)
    expect(plain).toMatch(/<h1[^>]*>T<\/h1>/)
    expect(plain).toMatch(/<h2[^>]*>Merhaba<\/h2>/)
    expect(startsWithHero([{ ...hero, appearance: { hidden: true } } as LayoutBlock, { blockType: 'spacer', id: 's' } as LayoutBlock])).toBe(false)
  })
})
