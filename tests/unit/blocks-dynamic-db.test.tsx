import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next-intl/server', () => ({
  getTranslations: async () => Object.assign((key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key), {}),
}))

/*
 * Real SQLite (all migrations) + the real anonymous loaders: query counts are measured with the
 * SM_DB_QUERY_LOG counter, draft/unpublished leakage is checked through Payload access rules.
 */
let payload: Payload
let dir: string
let data: typeof import('../../src/lib/blocks/data')
let stats: typeof import('../../src/lib/db-query-log')
let registry: typeof import('../../src/components/blocks/registry')
const run = (q: string) => payload.db.drizzle.$client.execute(q)
const ctx = { appearance: { theme: 'light', spacing: 'md', align: 'start', width: 'normal', animation: 'subtle', hidden: false }, index: 0, headingAs: 'h2', pageTop: false } as never
const count = async (fn: () => Promise<unknown>) => stats.withDbQueryContext(async () => { await fn(); return stats.getDbQueryStats()!.queries })
const create = (collection: string, doc: Record<string, unknown>, draft = false) =>
  payload.create({ collection: collection as 'posts', data: doc as never, draft, locale: 'tr', overrideAccess: true })
const render = async (type: string, block: Record<string, unknown>) => {
  const Block = registry.blockRegistry[type as keyof typeof registry.blockRegistry] as (p: unknown) => Promise<unknown>
  return renderToStaticMarkup((await Block({ block: { blockType: type, ...block }, locale: 'tr', ctx })) as never)
}
const titles = (docs: { title?: string }[]) => docs.map((d) => d.title)

let familyA: number, familyB: number, industryA: number, industryB: number
let published: number[] = []
let draftProduct: number

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-blocks-dynamic-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  process.env.SM_DB_QUERY_LOG = '1'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  data = await import('../../src/lib/blocks/data')
  stats = await import('../../src/lib/db-query-log')
  registry = await import('../../src/components/blocks/registry')
  for (const id of [1, 2]) {
    await run(`INSERT INTO media(id,filename,mime_type,protected,visibility) VALUES(${id},'dyn-${id}.png','image/png',0,'public')`)
    await run(`INSERT INTO media_locales(alt,_locale,_parent_id) VALUES('Dyn ${id}','tr',${id})`)
  }
  industryA = (await create('industries', { title: 'Sanayi' })).id
  industryB = (await create('industries', { title: 'Perakende' })).id
  familyA = (await create('product-families', { title: 'Aile A', tagline: 'A tag', sortOrder: 2, image: 1 })).id
  familyB = (await create('product-families', { title: 'Aile B', sortOrder: 1 })).id
  const mk = async (title: string, family: number, extra: Record<string, unknown> = {}) =>
    (await create('products', { title, family, tagline: `${title} tag`, _status: 'published', heroImage: 1, ...extra })).id
  published = [
    await mk('Urun Bir', familyA, { featured: true, sortOrder: 3, industries: [industryA] }),
    await mk('Urun Iki', familyA, { sortOrder: 1, industries: [industryB] }),
    await mk('Urun Uc', familyB, { featured: true, sortOrder: 2 }),
  ]
  draftProduct = (await create('products', { title: 'Taslak Urun', family: familyA, featured: true, industries: [industryA], _status: 'draft' }, true)).id
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('F5 data loaders: access', () => {
  it('keeps locales separate and ignores draft flags on public block inputs', async () => {
    await payload.update({ collection: 'products', id: published[0], locale: 'en', overrideAccess: true,
      data: { title: 'English Product', _status: 'published' } })
    const block = { source: 'manual', products: [published[0]], draft: true }
    const [tr, en] = await Promise.all([data.loadProducts('tr', block), data.loadProducts('en', block)])
    expect(titles(tr)).toEqual(['Urun Bir'])
    expect(titles(en)).toEqual(['English Product'])
  })
  it('the shared anonymous query options still enforce careers.isOpen and media access', async () => {
    const { anon, getCareers } = await import('../../src/lib/content')
    await create('careers', { title: 'Open Position', isOpen: true })
    await create('careers', { title: 'Private Closed Position', isOpen: false })
    expect(titles(await getCareers('tr'))).toEqual(['Open Position'])
    expect(anon('en')).toEqual({ locale: 'en', overrideAccess: false, user: null, draft: false })
    await run("INSERT INTO media(id,filename,mime_type,protected,visibility) VALUES(3,'private-secret.png','image/png',1,'licensed')")
    await payload.update({ collection: 'products', id: published[0], locale: 'tr', overrideAccess: true,
      data: { heroImage: 3, _status: 'published' } })
    const docs = await data.loadProducts('tr', { source: 'manual', products: [published[0]] })
    expect(JSON.stringify(docs)).not.toContain('private-secret')
    await payload.update({ collection: 'products', id: published[0], locale: 'tr', overrideAccess: true,
      data: { heroImage: 1, _status: 'published' } })
  })
  it('products: draft never listed, even when featured, filtered or manually selected', async () => {
    for (const block of [
      { source: 'featured' }, { source: 'all' }, { source: 'byFamily', family: familyA }, { source: 'byIndustry', industry: industryA },
      { source: 'manual', products: [draftProduct, ...published] },
    ]) {
      const docs = await data.loadProducts('tr', block)
      expect(titles(docs), JSON.stringify(block)).not.toContain('Taslak Urun')
      expect(docs.length, JSON.stringify(block)).toBeGreaterThan(0)
    }
  })
  it('a published record edited as draft still shows its published content', async () => {
    await payload.update({ collection: 'products', id: published[1], data: { title: 'Urun Iki TASLAK', _status: 'draft' }, draft: true, locale: 'tr', overrideAccess: true })
    const names = titles(await data.loadProducts('tr', { source: 'all' }))
    expect(names).toContain('Urun Iki')
    expect(names).not.toContain('Urun Iki TASLAK')
  })
  it('solutions, posts, case studies: drafts and manual draft selections are invisible', async () => {
    const solPub = (await create('solutions', { title: 'Cozum Yayin', _status: 'published', industries: [industryA] })).id
    const solDraft = (await create('solutions', { title: 'Cozum Taslak', industries: [industryA], _status: 'draft' }, true)).id
    expect(titles(await data.loadSolutions('tr', { source: 'all' }))).toEqual(['Cozum Yayin'])
    expect(titles(await data.loadSolutions('tr', { source: 'manual', solutions: [solDraft, solPub] }))).toEqual(['Cozum Yayin'])
    expect(titles(await data.loadSolutions('tr', { source: 'byIndustry', industry: industryA }))).toEqual(['Cozum Yayin'])
    expect(await data.loadSolutions('tr', { source: 'manual', solutions: [solDraft] })).toEqual([])

    const postPub = (await create('posts', { title: 'Haber Yayin', category: 'event', _status: 'published' })).id
    const postDraft = (await create('posts', { title: 'Haber Taslak', category: 'event', _status: 'draft' }, true)).id
    expect(titles(await data.loadPosts('tr', { source: 'latest' }))).toEqual(['Haber Yayin'])
    expect(titles(await data.loadPosts('tr', { source: 'category', category: 'event' }))).toEqual(['Haber Yayin'])
    expect(await data.loadPosts('tr', { source: 'category', category: 'blog' })).toEqual([])
    expect(await data.loadPosts('tr', { source: 'manual', posts: [postDraft] })).toEqual([])
    expect(titles(await data.loadPosts('tr', { source: 'manual', posts: [postDraft, postPub] }))).toEqual(['Haber Yayin'])

    const casePub = (await create('case-studies', { title: 'Vaka Yayin', customerName: 'Musteri A', customerLogo: 1, _status: 'published', industry: industryA })).id
    const caseDraft = (await create('case-studies', { title: 'Vaka Taslak', customerName: 'Musteri B', featured: true, industry: industryA, _status: 'draft' }, true)).id
    expect((await data.loadCaseStudy('tr', { source: 'featured' }))?.title).toBe('Vaka Yayin')
    expect((await data.loadCaseStudy('tr', { source: 'latest' }))?.title).toBe('Vaka Yayin')
    expect((await data.loadCaseStudy('tr', { source: 'byIndustry', industry: industryA }))?.title).toBe('Vaka Yayin')
    expect(await data.loadCaseStudy('tr', { source: 'manual', caseStudy: caseDraft })).toBeNull()
    expect((await data.loadCaseStudy('tr', { source: 'manual', caseStudy: casePub }))?.title).toBe('Vaka Yayin')
  })
  it('automatic logo sources never expose draft case studies', async () => {
    await create('partners', { name: 'Ortak Bir', logo: 1 })
    const names = (await data.loadLogos('tr', { source: 'partnersAndCaseStudies' })).map((l) => l.name)
    expect(names).toContain('Ortak Bir')
    expect(names).toContain('Musteri A')
    expect(names).not.toContain('Musteri B')
  })
})

describe('F5 data loaders: sources, sort, limit', () => {
  it('applies manual order before the limit, skipping inaccessible selections', async () => {
    expect(titles(await data.loadProducts('tr', { source: 'manual', sort: 'manual', limit: 1, products: [draftProduct, published[0], published[2], published[1]] })))
      .toEqual(['Urun Bir'])
    expect(titles((await data.loadFamilies('tr', { source: 'manual', sort: 'manual', limit: 1, families: [familyA, familyB] })).docs))
      .toEqual(['Aile A'])
    for (const [collection, loader, field] of [['solutions', data.loadSolutions, 'solutions'], ['posts', data.loadPosts, 'posts']] as const) {
      const first = (await create(collection, { title: `${collection} first`, _status: 'published', sortOrder: 99 })).id
      const second = (await create(collection, { title: `${collection} second`, _status: 'published', sortOrder: 0 })).id
      expect(titles(await loader('tr', { source: 'manual', sort: 'manual', limit: 1, [field]: [first, second] }))).toEqual([`${collection} first`])
    }
  })
  it('legacy logo sources re-read IDs, including populated selections, through anonymous access', async () => {
    const draft = (await create('case-studies', { title: 'Private case', customerName: 'PRIVATE CUSTOMER', _status: 'draft' }, true)).id
    const study = await create('case-studies', { title: 'Public case', customerName: 'Public Customer', customerLogo: 1, publishedAt: '2000-01-01T00:00:00Z', _status: 'published' })
    const partner = await create('partners', { name: 'Selected Partner', logo: 1 })
    const html = await render('logoWall', { source: 'caseStudies', caseStudies: [{ id: draft, customerName: 'PRIVATE CUSTOMER' }, study.id] })
    expect(html).not.toContain('PRIVATE CUSTOMER')
    expect(html).toContain('Public Customer')
    expect(await render('logoWall', { source: 'partners', partners: [partner.id] })).toContain('Selected Partner')
    expect(await render('logoWall', { source: 'caseStudies', caseStudies: [draft] })).toBe('')
    expect(await render('logoWall', { source: 'manual', logos: [{ name: 'Legacy manual', logo: null }] })).toContain('Legacy manual')
    const sameName = await create('partners', { name: 'Selected Partner', slug: 'same-name-partner' })
    expect((await data.loadLogos('tr', { source: 'partners', partners: [partner.id, sameName.id], limit: 1 })).map((l) => l.name))
      .toEqual(['Selected Partner', 'Selected Partner'])
  })
  it('filters missing automatic logos before limit and deduplication', async () => {
    await create('partners', { name: 'No Logo', sortOrder: -99 })
    const html = await render('logoWall', { source: 'allPartners', limit: 1 })
    expect(html).toContain('data-block="logoWall"')
    expect(html).not.toContain('No Logo')
    await create('partners', { name: 'Public Customer', logo: 3, sortOrder: -98 })
    expect(await render('logoWall', { source: 'partnersAndCaseStudies' })).toContain('Public Customer')
  })
  it('filters by family/industry and honours limit and sort', async () => {
    expect(titles(await data.loadProducts('tr', { source: 'byFamily', family: familyB }))).toEqual(['Urun Uc'])
    expect(titles(await data.loadProducts('tr', { source: 'byIndustry', industry: industryA }))).toEqual(['Urun Bir'])
    expect(titles(await data.loadProducts('tr', { source: 'featured', sort: 'order' }))).toEqual(['Urun Uc', 'Urun Bir'])
    expect(titles(await data.loadProducts('tr', { source: 'all', sort: 'order', limit: 2 }))).toEqual(['Urun Iki', 'Urun Uc'])
    expect(await data.loadProducts('tr', { source: 'byFamily' })).toEqual([])
    expect(titles(await data.loadProducts('tr', { source: 'manual', sort: 'manual', products: [published[2], published[0], published[1]] })))
      .toEqual(['Urun Uc', 'Urun Bir', 'Urun Iki'])
    const newest = titles(await data.loadProducts('tr', { source: 'all', sort: 'newest' }))
    const oldest = titles(await data.loadProducts('tr', { source: 'all', sort: 'oldest' }))
    expect(newest).toEqual([...oldest].reverse())
    const families = await data.loadFamilies('tr', { source: 'all' })
    expect(titles(families.docs)).toEqual(['Aile B', 'Aile A'])
    expect(families.counts.get(familyA)).toBe(2)
    expect(titles((await data.loadFamilies('tr', { source: 'manual', sort: 'manual', families: [familyA, familyB] })).docs)).toEqual(['Aile A', 'Aile B'])
  })
  it('an empty source resolves to nothing without a query', async () => {
    expect(await count(() => data.loadFamilies('tr', { source: 'manual', families: [] }))).toBe(0)
    expect(await count(() => data.loadProducts('tr', { source: 'manual', products: [] }))).toBe(0)
    expect(await count(() => data.loadCaseStudy('tr', { source: 'manual' }))).toBe(0)
    expect(await count(() => data.loadLogos('tr', { source: 'manual' }))).toBe(0)
  })
})

describe('F5 data loaders: constant query count (no N+1)', () => {
  it('query count does not grow with the number of records', async () => {
    const measure = async () => ({
      families: await count(() => data.loadFamilies('tr', { source: 'all', limit: 24 })),
      products: await count(() => data.loadProducts('tr', { source: 'all', limit: 24 })),
      solutions: await count(() => data.loadSolutions('tr', { source: 'all', limit: 24 })),
      posts: await count(() => data.loadPosts('tr', { source: 'latest', limit: 24 })),
      logos: await count(() => data.loadLogos('tr', { source: 'partnersAndCaseStudies', limit: 24 })),
      caseStudy: await count(() => data.loadCaseStudy('tr', { source: 'featured' })),
    })
    // Same relation shapes before and after (records with images), so only the record count differs.
    await create('solutions', { title: 'Basis Cozum', heroImage: 1, _status: 'published' })
    await create('posts', { title: 'Basis Haber', coverImage: 1, _status: 'published' })
    const few = await measure()
    for (let i = 0; i < 6; i++) {
      const image = 10 + i
      await run(`INSERT INTO media(id,filename,mime_type,protected,visibility) VALUES(${image},'unique-${i}.png','image/png',0,'public')`)
      await create('product-families', { title: `Ek Aile ${i}`, image })
      await create('products', { title: `Ek Urun ${i}`, family: i % 2 ? familyA : familyB, heroImage: image, _status: 'published' })
      await create('solutions', { title: `Ek Cozum ${i}`, heroImage: image, _status: 'published' })
      await create('posts', { title: `Ek Haber ${i}`, coverImage: image, _status: 'published' })
      await create('partners', { name: `Ek Ortak ${i}`, logo: image })
    }
    const many = await measure()
    expect(many).toEqual(few)
    console.info('F5 query counts per block loader:', JSON.stringify(many))
    // Two independent logo sources each perform their own batched media read (up to 3 SQL statements).
    for (const [name, n] of Object.entries(many)) expect(n, name).toBeLessThanOrEqual(name === 'logos' ? 6 : 4)
  })
})

describe('F5 renderers', () => {
  it('render published records only and hide the block when the source is empty', async () => {
    const families = await render('productFamilies', { heading: 'Ailelerimiz', source: 'all', layout: 'grid-2', showCount: true, limit: 24 })
    expect(families).toContain('Ailelerimiz')
    expect(families).toContain('Aile A')
    expect(families).toContain('/urunler/aile-a')
    expect(families).toContain('md:grid-cols-2')
    const showcase = await render('productShowcase', { source: 'featured', layout: 'alternating' })
    expect(showcase).toContain('Urun Bir')
    expect(showcase).not.toContain('Taslak Urun')
    expect(showcase).toContain('/urunler/aile-a/urun-bir')
    const list = await render('newsList', { source: 'category', category: 'event', layout: 'list' })
    expect(list).toContain('Haber Yayin')
    expect(list).not.toContain('Haber Taslak')
    expect(await render('caseStudy', { source: 'featured', eyebrow: 'Vaka' })).toContain('Vaka Yayin')
    expect(await render('solutionsGrid', { source: 'manual', solutions: [] })).toBe('')
    expect(await render('productShowcase', { source: 'byFamily' })).toBe('')
    expect(await render('newsList', { source: 'category', category: 'blog' })).toBe('')
    expect(await render('caseStudy', { source: 'manual' })).toBe('')
    expect(await render('logoWall', { source: 'allPartners', heading: 'Ortaklar' })).toContain('Ortak Bir')
  })
  it('view-all link is optional, safe and defaults to the list page', async () => {
    expect(await render('newsList', { source: 'latest' })).toContain('/tr/haberler')
    expect(await render('newsList', { source: 'latest', showViewAll: false })).not.toContain('viewAll')
    const custom = await render('newsList', { source: 'latest', viewAllUrl: '/tr/hakkimizda', viewAllLabel: 'Hepsi' })
    expect(custom).toContain('Hepsi')
    expect(await render('newsList', { source: 'latest', viewAllUrl: 'javascript:alert(1)' })).not.toContain('javascript:')
  })
  it('a full page of dynamic blocks runs a bounded number of queries', async () => {
    const { RenderBlocks } = await import('../../src/components/blocks/render-blocks')
    const blocks = ['productFamilies', 'productShowcase', 'solutionsGrid', 'caseStudy', 'newsList'].map((blockType) => ({ blockType, id: blockType }))
    const queries = await count(async () => {
      const tree = RenderBlocks({ blocks: blocks as never, locale: 'tr' })
      // Async server components are resolved by hand: this is what React does for each child.
      for (const child of (tree as { props: { children: { props: { block: unknown } }[] } }).props.children) {
        const el = child as { type: (p: unknown) => Promise<unknown>; props: unknown }
        await el.type(el.props)
      }
    })
    console.info('F5 queries for a 5-block page:', queries)
    // Outside a React render `cache()` does not dedupe, so each loader runs twice here (preload + render).
    expect(queries).toBeLessThanOrEqual(40)
  })
})
