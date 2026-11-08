import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ find: vi.fn(), findGlobal: vi.fn(), findByID: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => client) }))

import {
  getCareer, getCareers, getCaseStudies, getCaseStudy, getCatalogProducts, getContactSettings,
  getFamilies, getFamily, getPage, getPartners, getPost, getPosts, getProductDetail, getProductFamilyCounts,
  getProductVariants, getSitemapEntries, getSlugVariants, getSolution, getSolutions,
} from '@/lib/content'

beforeEach(() => {
  vi.clearAllMocks()
  client.find.mockResolvedValue({ docs: [], totalPages: 0 })
  client.findGlobal.mockResolvedValue({})
  client.findByID.mockResolvedValue({})
})

describe('public content queries', () => {
  it('enforces anonymous access, publication, selected fields and bounded population throughout', async () => {
    await Promise.all([
      getFamilies('tr'), getFamily('en', 'family'), getCatalogProducts('en'), getSolutions('tr'),
      getSolution('en', 'solution'), getCaseStudies('tr'), getCaseStudy('en', 'case'),
      getPosts('tr'), getPost('en', 'post'), getCareers('tr'), getCareer('en', 'career'),
      getPartners('tr'), getPage('en', 'page'), getContactSettings('tr'),
      getSlugVariants('posts', 1), getProductVariants(1),
    ])
    for (const [options] of [...client.find.mock.calls, ...client.findGlobal.mock.calls, ...client.findByID.mock.calls]) {
      expect(options).toMatchObject({ overrideAccess: false, user: null, draft: false })
      expect(options.depth).toBeLessThanOrEqual(2)
      expect(options.select).toBeDefined()
      for (const field of ['author', 'customer', 'licenses', 'password', 'downloads']) {
        expect(options.select).not.toHaveProperty(field)
      }
    }
    const contact = client.findGlobal.mock.calls[0][0]
    expect(contact.select.company).toEqual({ legalName: true })
    expect(contact.select).not.toHaveProperty('commerce')
  })

  it('does not persist React cache outside a render, as in CLI and import callers', async () => {
    client.find.mockResolvedValueOnce({ docs: [{ id: 1, slug: 'first' }] })
      .mockResolvedValueOnce({ docs: [{ id: 1, slug: 'updated' }] })
    expect((await getFamily('tr', 'family'))?.slug).toBe('first')
    expect((await getFamily('tr', 'family'))?.slug).toBe('updated')
    expect(client.find).toHaveBeenCalledTimes(2)
  })

  it('keeps valid family counts when a product has a missing relationship or slug', async () => {
    client.find.mockResolvedValue({ docs: [
      { slug: 'one', family: 1 }, { slug: 'two', family: { id: 1 } },
      { slug: 'orphan', family: null }, { slug: 'missing-family' }, { family: 1 },
    ] })
    expect(await getProductFamilyCounts('en')).toEqual(new Map([[1, 2]]))
    expect(client.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'products', locale: 'en', user: null, draft: false, overrideAccess: false, depth: 0,
    }))
  })

  it('never requests licensed downloads or unrelated commerce relations on product pages', async () => {
    client.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'product-families' ? [{ id: 1, slug: 'family' }]
        : collection === 'products' ? [{ id: 2, slug: 'product' }] : [],
    }))
    const result = await getProductDetail('tr', 'family', 'product')
    expect(result?.downloads).toEqual([])
    expect(client.find.mock.calls.map(([o]) => o.collection).sort())
      .toEqual(['docs', 'downloads', 'editions', 'product-families', 'products'])
    const download = client.find.mock.calls.find(([o]) => o.collection === 'downloads')![0]
    expect(download).toMatchObject({
      overrideAccess: false, user: null, draft: false, depth: 1,
      where: { and: [{ product: { equals: 2 } }, { access: { equals: 'public' } }] },
    })
    expect(download.select).not.toHaveProperty('product')
  })

  it('limits the sitemap to public route collections and legal pages, without slug fallbacks', async () => {
    await getSitemapEntries()
    expect(client.find.mock.calls.map(([o]) => o.collection).sort())
      .toEqual(['careers', 'case-studies', 'pages', 'posts', 'product-families', 'products', 'solutions'])
    for (const [options] of client.find.mock.calls) {
      expect(options).toMatchObject({ locale: 'all', fallbackLocale: false, overrideAccess: false, user: null, draft: false })
      expect(options.depth).toBeLessThanOrEqual(1)
      // Legal pages plus F6 landing pages (standard/landing); templates never get a URL.
      if (options.collection === 'pages') expect(options.where).toEqual({ pageType: { in: ['legal', 'standard', 'landing'] } })
    }
  })

  it('keeps draft legal pages (banner/placeholders) out of the sitemap per locale', async () => {
    const draft = [{ blockType: 'richText', content: 'TASLAK — Yayın öncesi incelenmelidir. [ŞİRKET UNVANI]' }]
    client.find.mockImplementation(async (o: { collection: string; locale: string; select?: Record<string, boolean> }) => {
      if (o.collection !== 'pages') return { docs: [] }
      if (o.select?.layout) return { docs: [{ id: 7, layout: o.locale === 'tr' ? draft : [{ blockType: 'richText', content: 'Reviewed' }] }] }
      return { docs: [{ id: 7, pageType: 'legal', slug: { tr: 'eula', en: 'eula-en' } }] }
    })
    const entries = await getSitemapEntries()
    expect(entries).toEqual([expect.objectContaining({ paths: { en: '/yasal/eula-en' } })])
  })

  it('excludes legal pages missing from the draft check', async () => {
    client.find.mockImplementation(async (o: { collection: string; select?: Record<string, boolean> }) => {
      if (o.collection !== 'pages' || o.select?.layout) return { docs: [] }
      return { docs: [{ id: 7, pageType: 'legal', slug: { tr: 'eula', en: 'eula-en' } }] }
    })
    expect(await getSitemapEntries()).toEqual([])
  })

  it('keeps localized product paths paired with their own family locale', async () => {
    client.findByID.mockResolvedValue({ slug: { tr: 'urun', en: 'product' }, family: { slug: { tr: 'aile' } } })
    expect(await getProductVariants(2)).toEqual({ tr: ['aile', 'urun'] })
  })
})
