import { beforeEach, describe, expect, it, vi } from 'vitest'
const client = vi.hoisted(() => ({ find: vi.fn(), findByID: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => client) }))
import {
  getDoc,
  getDocTree,
  getDownloads,
  getFaqs,
  getReleases,
  getSupportEditions,
  getSupportSitemapEntries,
  orderDocTree,
  supportVariants,
} from '@/lib/support'
import { searchSite } from '@/lib/search'
import { publicSearchRead } from '@/access/search'
import { getLeadForm } from '@/lib/forms/data'

beforeEach(() => {
  vi.clearAllMocks()
  client.find.mockImplementation(async ({ collection }) => ({
    docs: collection === 'products' ? [{ id: 1, title: 'Public product', slug: 'public' }] : [],
    totalPages: 1,
  }))
  client.findByID.mockResolvedValue(null)
})
describe('support query security', () => {
  it('projects every public read and never queries licensed downloads', async () => {
    await Promise.all([
      getDocTree('tr', 1),
      getDoc('tr', 1, 'doc'),
      getDownloads('tr', { productId: 1, os: 'linux', releaseId: 2 }),
      getFaqs('tr'),
      getReleases('tr'),
      getSupportEditions('tr'),
      getLeadForm('demo', 'tr'),
      getSupportSitemapEntries(),
    ])
    for (const [options] of client.find.mock.calls) {
      expect(options).toMatchObject({ overrideAccess: false, user: null, draft: false })
      expect(options.select).toBeDefined()
      expect(options.depth).toBeLessThanOrEqual(1)
      expect(options.select).not.toHaveProperty('emails')
      expect(options.select).not.toHaveProperty('downloads')
    }
    const download = client.find.mock.calls.find(([o]) => o.collection === 'downloads')![0]
    expect(download.where.and).toContainEqual({ access: { equals: 'public' } })
    expect(download.where.and).toContainEqual({ product: { in: [1] } })
    expect(download.where.and).toContainEqual({ release: { equals: 2 } })
  })
  it('returns no docs for an unpublished product without querying docs', async () => {
    expect(await getDoc('tr', 999, 'hidden')).toBeNull()
    expect(await getDocTree('tr', 999)).toEqual([])
    expect(client.find.mock.calls.every(([o]) => o.collection === 'products')).toBe(true)
  })
  it('orders nested docs and handles cycles/orphaned parents', () => {
    const docs = [
      { id: 2, title: 'child', slug: 'child', parent: 1 },
      { id: 1, title: 'root', slug: 'root' },
      { id: 3, title: 'cycle', slug: 'cycle', parent: 4 },
      { id: 4, title: 'cycle 2', slug: 'cycle-2', parent: 3 },
    ]
    expect(orderDocTree(docs).map((d) => [d.id, d.level])).toEqual([
      [1, 0],
      [2, 1],
      [3, 0],
      [4, 1],
    ])
  })
  it('resolves translated document paths by stable IDs without locale fallback', async () => {
    client.findByID.mockImplementation(async ({ collection }) =>
      collection === 'products'
        ? { slug: { tr: 'urun', en: 'product' } }
        : { slug: { tr: 'baslangic', en: 'start' } },
    )
    expect(await supportVariants(1, 2)).toEqual({
      tr: '/destek/dokumantasyon/urun/baslangic',
      en: '/destek/dokumantasyon/product/start',
    })
    expect(
      client.findByID.mock.calls.every(
        ([o]) => o.fallbackLocale === false && o.overrideAccess === false,
      ),
    ).toBe(true)
  })
})
describe('search publication boundary', () => {
  it('checks current source access and renders source text rather than stale index titles', async () => {
    client.find.mockImplementation(async ({ collection }) => ({
      docs:
        collection === 'search'
          ? [
              { id: 20, title: 'SECRET STALE', doc: { relationTo: 'posts', value: 3 } },
              { id: 21, title: 'PRIVATE', doc: { relationTo: 'docs', value: 4 } },
            ]
          : [{ id: 1, slug: 'public' }],
      totalPages: 2,
    }))
    client.findByID.mockImplementation(async ({ id }) =>
      id === 3 ? { title: 'Public post', slug: 'post' } : null,
    )
    expect(await searchSite('en', 'hello', 1)).toEqual({
      docs: [{ id: 20, title: 'Public post', href: '/haberler/post', kind: 'posts' }],
      totalPages: 2,
    })
    expect(
      client.findByID.mock.calls.every(
        ([o]) => o.overrideAccess === false && o.user === null && o.draft === false,
      ),
    ).toBe(true)
  })
  it('matches ASCII product queries against localized slugs as well as titles', async () => {
    client.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'search' ? [{ id: 30, doc: { relationTo: 'products', value: 1 } }] : [{ id: 1 }],
      totalPages: 1,
    }))
    client.findByID.mockResolvedValue({ id: 1, title: 'Akış Merkezi', slug: 'akis-merkezi', family: { slug: 'akis-yonetimi' } })
    expect((await searchSite('tr', 'akis')).docs).toEqual([
      { id: 30, title: 'Akış Merkezi', href: '/urunler/akis-yonetimi/akis-merkezi', kind: 'products' },
    ])
    expect(client.find.mock.calls.find(([o]) => o.collection === 'search')![0].where.or).toContainEqual({ slug: { contains: 'akis' } })
  })
  it('does not query for blank/short/long searches or invalid page numbers', async () => {
    for (const q of ['', 'a', 'x'.repeat(121)]) expect((await searchSite('tr', q)).docs).toEqual([])
    expect((await searchSite('tr', 'valid', 1001)).docs).toEqual([])
    expect(client.find).not.toHaveBeenCalled()
  })
  it('restricts anonymous index reads to public source IDs and fails closed', async () => {
    const access = publicSearchRead as (args: unknown) => Promise<unknown>
    const result = await access({ req: { user: null, payload: client } })
    expect(result).toEqual({
      or: [{ and: [{ 'doc.relationTo': { equals: 'products' } }, { 'doc.value': { in: [1] } }] }],
    })
    client.find.mockRejectedValue(new Error('DB unavailable'))
    expect(await access({ req: { user: null, payload: client } })).toBe(false)
  })
})
