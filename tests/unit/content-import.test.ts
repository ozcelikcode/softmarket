import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import example from '../fixtures/content-example'
import schema from '../../content/seed/schema.json'
import { seedSchema, validateSeed, type Data, type Seed } from '../../src/lib/content-import/schema'
import { importContent, loadLegal, loadSources, safeMediaPath } from '../../src/lib/content-import/importer'

function fakePayload() {
  const store = new Map<string, Data[]>()
  let next = 1
  const match = (doc: Data, where: Data): boolean => {
    if (where.and) return (where.and as Data[]).every(w => match(doc, w))
    return Object.entries(where).every(([key, rule]) => doc[key] === (rule as Data).equals)
  }
  const client = {
    find: vi.fn(async ({ collection, where }: { collection: string; where: Data }) => ({ docs: (store.get(collection) ?? []).filter(d => match(d, where)) })),
    findByID: vi.fn(async ({ collection, id }: { collection: string; id: number }) => store.get(collection)?.find(d => d.id === id)),
    create: vi.fn(async ({ collection, data }: { collection: string; data: Data }) => {
      const doc = { ...data, id: next++ }
      store.set(collection, [...store.get(collection) ?? [], doc])
      return doc
    }),
    update: vi.fn(async ({ collection, id, data, locale }: { collection: string; id: number; data: Data; locale?: string }) => {
      const doc = store.get(collection)!.find(d => d.id === id)!
      if (locale !== 'en') Object.assign(doc, data)
      return doc
    }),
    findGlobal: vi.fn(async () => ({})), updateGlobal: vi.fn(async () => ({})),
  }
  return { payload: client as unknown as Payload, store, client }
}
const run = (payload: Payload, seed: unknown = example, dryRun = false) => importContent({
  payload, root: resolve('content/seed'), sources: [{ file: 'fixture.json', seed: seed as Seed }],
  dryRun, markdown: text => ({ root: { text } }), log: () => {},
})
describe('content import', () => {
  it('keeps the shipped JSON Schema in sync with the collection/block model', () => expect(schema).toEqual(seedSchema))
  it('accepts the bilingual minimal example', () => expect(() => validateSeed(example, 'example.json')).not.toThrow())
  it('rejects unsafe hero motion before writes, including a dry run', async () => {
    for (const preset of ['fade', 'zoom-in', 'stagger']) {
      const doc = { slug: 'motion-test', title: 'Motion', layout: [{ blockType: 'hero', heading: 'Hero', motion: { preset } }] }
      const { payload, client } = fakePayload()
      await expect(run(payload, { version: 1, pages: [{ tr: doc, en: doc }] }, true)).rejects.toThrow(/preset/)
      expect(client.create).not.toHaveBeenCalled()
      expect(client.update).not.toHaveBeenCalled()
    }
  })
  it('rejects list limits above 24 in the JSON schema before mutation', async () => {
    for (const blockType of ['productFamilies', 'productShowcase', 'solutionsGrid', 'newsList', 'logoWall']) {
      const doc = { slug: 'too-many', title: 'Too many', layout: [{ blockType, limit: 25 }] }
      const { payload, client } = fakePayload()
      await expect(run(payload, { version: 1, pages: [{ tr: doc, en: doc }] })).rejects.toThrow(/<= 24/)
      expect(client.create).not.toHaveBeenCalled()
    }
  })
  it.each([
    { version: 1, products: [{ tr: { title: 'bad' } }] },
    { ...example, products: [{ tr: { ...example.products[0].tr, family: 42 }, en: example.products[0].en }] },
    { ...example, editions: [{ tr: { ...example.editions[0].tr, price: 100 }, en: example.editions[0].en }] },
    { version: 1, customers: [] },
    { ...example, products: [{ tr: { ...example.products[0].tr, _status: 'published', roles: ['admin'] }, en: example.products[0].en }] },
    { ...example, products: [{ tr: { ...example.products[0].tr, protected: false }, en: example.products[0].en }] },
    { version: 1, media: [{ path: 'media/../../secret', alt: { tr: 'a', en: 'b' }, protected: false }] },
    { ...example, editions: [{ tr: { ...example.editions[0].tr, licenseType: 'subscription' }, en: example.editions[0].en }] },
  ])('rejects invalid seed input before mutation', async seed => {
    const { payload, client } = fakePayload()
    await expect(run(payload, seed)).rejects.toThrow('fixture.json')
    expect(client.create).not.toHaveBeenCalled()
  })
  it('resolves slug relationships and preserves identities/row IDs on a second run', async () => {
    const { payload, store, client } = fakePayload()
    expect(await run(payload)).toEqual({ creates: 3, updates: 0 })
    const firstIds = [...store.values()].flat().map(d => d.id)
    const row = (store.get('products')![0].layout as Data[])[0].id
    expect(await run(payload)).toEqual({ creates: 0, updates: 3 })
    expect([...store.values()].flat().map(d => d.id)).toEqual(firstIds)
    expect((store.get('products')![0].layout as Data[])[0].id).toBe(row)
    expect(store.get('products')![0].family).toBe(store.get('product-families')![0].id)
    expect(store.get('editions')![0].product).toBe(store.get('products')![0].id)
    expect(store.get('products')![0]._status).toBe('published')
    expect(client.update.mock.calls.some(([args]) => 'locale' in args && args.locale === 'en')).toBe(true)
  })
  it('dry run resolves fresh dependencies without any write', async () => {
    const { payload, client } = fakePayload()
    expect(await run(payload, example, true)).toEqual({ creates: 3, updates: 0 })
    expect(client.create).not.toHaveBeenCalled(); expect(client.update).not.toHaveBeenCalled()
  })
  it('plans scoped docs, forward parents and releases without querying planned product IDs', async () => {
    const { payload, client } = fakePayload()
    const seed = { ...example, docs: ['child', 'parent'].map(slug => ({
      tr: { slug, title: slug, product: 'ornek-urun', ...(slug === 'child' ? { parent: 'ornek-urun/parent' } : {}) },
      en: { slug, title: slug, product: 'ornek-urun', ...(slug === 'child' ? { parent: 'ornek-urun/parent' } : {}) },
    })), releases: [{ tr: { product: 'ornek-urun', version: '1.0.0', releaseDate: '2026-11-06', notes: { markdown: 'Notes' } }, en: { product: 'ornek-urun', version: '1.0.0', releaseDate: '2026-11-06', notes: { markdown: 'Notes' } } }] }
    expect(await run(payload, seed, true)).toEqual({ creates: 6, updates: 0 })
    expect(client.find.mock.calls.some(([args]) => ['docs', 'releases'].includes(args.collection))).toBe(false)
    expect(client.create).not.toHaveBeenCalled()
    expect(client.update).not.toHaveBeenCalled()
  })
  it.each([NaN, undefined, Infinity, 'dry:unknown'])('rejects invalid database ID %s before using it as a relationship', async id => {
    const { payload, store, client } = fakePayload()
    store.set('product-families', [{ id, slug: 'ornek-aile' }])
    await expect(run(payload, example, true)).rejects.toThrow('Invalid database ID for product-families:ornek-aile')
    expect(client.find).toHaveBeenCalledTimes(1)
    expect(client.create).not.toHaveBeenCalled()
  })
  it('reports the source record and unresolved slug', async () => {
    const { payload } = fakePayload()
    await expect(run(payload, { version: 1, products: example.products })).rejects.toThrow(/fixture.json: products\[0\].*Unresolved relationship product-families:ornek-aile/)
  })
  it('rejects conflicting shared fields and duplicate identities', async () => {
    const { payload } = fakePayload()
    const bad = structuredClone(example)
    bad.products[0].en.family = 'other'
    await expect(run(payload, bad)).rejects.toThrow('non-localized values must match')
    await expect(run(payload, { ...example, products: [...example.products, ...example.products] })).rejects.toThrow('duplicate identity')
  })
  it('resolves optional product/FAQ cycles and scoped documentation parents', async () => {
    const { payload, store } = fakePayload()
    const seed = structuredClone(example) as unknown as Seed
    const product = (seed.products as { tr: Data; en: Data }[])[0]
    for (const locale of ['tr', 'en'] as const) product[locale].layout = [{ blockType: 'faq', faqs: ['license-help'] }]
    seed.faqs = [{ tr: { slug: 'license-help', question: 'Lisans?', answer: { markdown: 'Yanıt' }, product: 'ornek-urun' }, en: { slug: 'license-help', question: 'License?', answer: { markdown: 'Answer' }, product: 'ornek-urun' } }]
    seed.docs = ['child', 'parent'].map(slug => ({
      tr: { slug, title: slug, product: 'ornek-urun', ...(slug === 'child' ? { parent: 'ornek-urun/parent' } : {}) },
      en: { slug, title: slug, product: 'ornek-urun', ...(slug === 'child' ? { parent: 'ornek-urun/parent' } : {}) },
    }))
    expect(await run(payload, seed)).toEqual({ creates: 6, updates: 0 })
    expect(store.get('faqs')![0].product).toBe(store.get('products')![0].id)
    const docs = store.get('docs')!
    expect(docs.find(d => d.slug === 'child')!.parent).toBe(docs.find(d => d.slug === 'parent')!.id)
  })
  describe('editor-composed product layout (decision b)', () => {
    const bound = [{ blockType: 'productHero' }, { blockType: 'productEditions' }, { blockType: 'richText', content: { markdown: 'x' } }]
    const withTitle = (title: string, layout?: Data[]) => {
      const seed = structuredClone(example) as unknown as { products: { tr: Data; en: Data }[] }
      seed.products[0].tr.title = title
      for (const l of ['tr', 'en'] as const) { if (layout) seed.products[0][l].layout = layout; }
      return seed as unknown as Seed
    }
    const setup = async () => {
      const f = fakePayload()
      await run(f.payload)
      f.store.get('products')![0].layout = bound.map((b, i) => ({ ...b, id: `b${i}` }))
      return f
    }
    const capture = (payload: Payload, seed: Seed, dryRun = false) => {
      const logs: string[] = []
      return importContent({ payload, root: resolve('content/seed'), sources: [{ file: 'f.json', seed }], dryRun, markdown: t => ({ root: { text: t } }), log: m => logs.push(m) }).then(r => ({ r, logs }))
    }
    it('keeps composed layout, updates other fields, warns, no error', async () => {
      const { payload, store } = await setup()
      const { logs } = await capture(payload, withTitle('Yeni Başlık'))
      const product = store.get('products')![0]
      expect(product.title).toBe('Yeni Başlık')
      expect((product.layout as Data[]).map(b => b.blockType)).toEqual(['productHero', 'productEditions', 'richText'])
      expect(logs.some(l => l.includes('warn products:ornek-urun') && l.includes('layout korundu (editörde düzenlenmiş)'))).toBe(true)
    })
    it('dry run gives the same decision and writes nothing', async () => {
      const { payload, store, client } = await setup()
      client.update.mockClear()
      const { logs } = await capture(payload, withTitle('Yeni Başlık'), true)
      expect(client.update).not.toHaveBeenCalled()
      expect(store.get('products')![0].title).toBe('Örnek Ürün')
      expect(logs.some(l => l.includes('layout korundu'))).toBe(true)
    })
    it.each([false, true])('does not resolve references or markdown in a skipped layout (dryRun=%s)', async dryRun => {
      const { payload, store, client } = await setup()
      const before = structuredClone(store.get('products')![0].layout)
      const seed = withTitle('Yeni Başlık', [
        { blockType: 'faq', faqs: ['removed-faq'] },
        { blockType: 'richText', content: { markdown: 'Unused seed text' } },
      ])
      const markdown = vi.fn(() => { throw new Error('Skipped markdown must not be converted') })
      const req = { transactionID: 'import-transaction' }
      const logs: string[] = []
      client.update.mockClear()
      await expect(importContent({ payload, req, root: resolve('content/seed'),
        sources: [{ file: 'skipped-layout.json', seed }], dryRun, markdown, log: m => logs.push(m),
      })).resolves.toMatchObject({ creates: 0 })
      expect(markdown).not.toHaveBeenCalled()
      expect(store.get('products')![0].layout).toEqual(before)
      expect(logs.filter(l => l.includes('layout korundu'))).toHaveLength(1)
      expect(client.find).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'faqs' }))
      expect(client.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'products', draft: true, fallbackLocale: false, req }))
      if (!dryRun) for (const locale of ['tr', 'en']) {
        const call = client.update.mock.calls.find(([args]) => args.collection === 'products' && args.locale === locale)![0]
        expect(call.data).not.toHaveProperty('layout')
        expect(call).toHaveProperty('req', req)
      }
    })
    it.each(['tr', 'en'] as const)('rejects a seed composed only in %s before writing', async locale => {
      const { payload, client } = await setup()
      const seed = withTitle('T')
      const products = seed.products as { tr: Data; en: Data }[]
      products[0][locale].layout = bound
      client.update.mockClear()
      await expect(capture(payload, seed)).rejects.toThrow(/tr\/en (array lengths|block types) differ/)
      expect(client.update).not.toHaveBeenCalled()
    })
    it('writes the seed when it is composed too', async () => {
      const { payload, store } = await setup()
      const { logs } = await capture(payload, withTitle('T', [{ blockType: 'productHero' }, { blockType: 'productEditions' }]))
      expect((store.get('products')![0].layout as Data[]).map(b => b.blockType)).toEqual(['productHero', 'productEditions'])
      expect(logs.some(l => l.includes('layout korundu'))).toBe(false)
    })
    it('writes the seed for a new product', async () => {
      const f = fakePayload()
      const { logs } = await capture(f.payload, withTitle('T'))
      expect((f.store.get('products')![0].layout as Data[])[0].blockType).toBe('hero')
      expect(logs.some(l => l.includes('layout korundu'))).toBe(false)
    })
    it('is idempotent', async () => {
      const { payload, store } = await setup()
      await capture(payload, withTitle('T')); await capture(payload, withTitle('T'))
      expect(store.get('products')).toHaveLength(1)
      expect(store.get('products')![0].layout as Data[]).toHaveLength(3)
    })
    it('still imports page layouts while a product layout is protected', async () => {
      const { payload, store } = await setup()
      store.set('pages', [{ id: 500, slug: 'landing', title: 'Old', layout: [{ blockType: 'cta', heading: 'Old CTA' }] }])
      const seed = withTitle('T')
      const page = { slug: 'landing', title: 'Landing', layout: [{ blockType: 'hero', heading: 'New hero' }] }
      seed.pages = [{ tr: page, en: page }]
      const { logs } = await capture(payload, seed)
      expect((store.get('pages')![0].layout as Data[])[0]).toMatchObject({ blockType: 'hero', heading: 'New hero' })
      expect(logs.filter(l => l.includes('layout korundu'))).toEqual(['warn products:ornek-urun layout korundu (editörde düzenlenmiş)'])
    })
  })
  it('reports the file path for syntactically invalid JSON', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'softmarket-bad-json-'))
    const file = resolve(dir, 'bad.json')
    try {
      await writeFile(file, '{broken')
      await expect(loadSources(file)).rejects.toThrow(`${file}: invalid JSON`)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('loads seed files, excluding the JSON Schema', async () => {
    const dir = await mkdtemp(resolve(tmpdir(), 'softmarket-seed-'))
    try {
      await writeFile(resolve(dir, 'schema.json'), '{}')
      await writeFile(resolve(dir, 'example.json'), JSON.stringify(example))
      const sources = await loadSources(dir)
      expect(sources).toHaveLength(1)
      expect(sources[0].file).toMatch(/example.json$/)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
  it('maps all legal drafts into bilingual legal pages with Markdown blocks', async () => {
    const source = await loadLegal(resolve('content/legal'))
    validateSeed(source.seed, source.file)
    const pages = source.seed.pages as { tr: Data; en: Data }[]
    expect(pages).toHaveLength(5)
    expect(pages.every(p => p.tr.pageType === 'legal' && p.en.pageType === 'legal')).toBe(true)
    expect(pages.find(p => p.tr.slug === 'kvkk-aydinlatma')).toBeTruthy()
    expect(await readFile('content/legal/tr/kvkk-aydinlatma.md', 'utf8')).toContain('Cloudflare Web Analytics')
  })
  it('resolves F5 dynamic block relationships by TR slug (including DB-only case studies) and rejects unknown targets', async () => {
    const { payload, store } = fakePayload()
    store.set('case-studies', [{ id: 777, slug: 'musteri-vaka' }])
    const layout = [
      { blockType: 'productFamilies', source: 'manual', families: ['ornek-aile'], layout: 'grid-2' },
      { blockType: 'productShowcase', source: 'manual', products: ['ornek-urun'] },
      { blockType: 'productShowcase', source: 'byFamily', family: 'ornek-aile' },
      { blockType: 'solutionsGrid', source: 'manual', solutions: ['cozum-bir'] },
      { blockType: 'solutionsGrid', source: 'byIndustry', industry: 'sanayi' },
      { blockType: 'caseStudy', source: 'manual', caseStudy: 'musteri-vaka' },
      { blockType: 'newsList', source: 'manual', posts: ['haber-bir'] },
    ]
    const seed = {
      ...example,
      industries: [{ tr: { slug: 'sanayi', title: 'Sanayi' }, en: { slug: 'sanayi', title: 'Industry' } }],
      solutions: [{ tr: { slug: 'cozum-bir', title: 'Çözüm' }, en: { slug: 'cozum-bir', title: 'Solution' } }],
      posts: [{ tr: { slug: 'haber-bir', title: 'Haber' }, en: { slug: 'haber-bir', title: 'News' } }],
      pages: [{
        tr: { slug: 'dinamik', title: 'Dinamik', pageType: 'landing', layout: layout.map((b) => (b.blockType === 'caseStudy' ? b : { ...b, heading: 'TR' })) },
        en: { slug: 'dynamic', title: 'Dynamic', pageType: 'landing', layout: layout.map((b) => (b.blockType === 'caseStudy' ? b : { ...b, heading: 'EN' })) },
      }],
    } as unknown as Seed
    expect(() => validateSeed(seed, 'dynamic.json')).not.toThrow()
    await run(payload, seed)
    const page = store.get('pages')![0].layout as Data[]
    const id = (collection: string, slug: string) => store.get(collection)!.find((d) => d.slug === slug)!.id
    expect(page[0].families).toEqual([id('product-families', 'ornek-aile')])
    expect(page[1].products).toEqual([id('products', 'ornek-urun')])
    expect(page[2].family).toBe(id('product-families', 'ornek-aile'))
    expect(page[3].solutions).toEqual([id('solutions', 'cozum-bir')])
    expect(page[4].industry).toBe(id('industries', 'sanayi'))
    expect(page[5].caseStudy).toBe(777)
    expect(page[6].posts).toEqual([id('posts', 'haber-bir')])
    const unknown = structuredClone(seed) as unknown as { pages: { tr: { layout: Data[] }; en: { layout: Data[] } }[] }
    for (const locale of ['tr', 'en'] as const) unknown.pages[0][locale].layout[5].caseStudy = 'yok-boyle-vaka'
    await expect(run(fakePayload().payload, unknown as unknown as Seed)).rejects.toThrow(/Unresolved relationship case-studies:yok-boyle-vaka/)
    const invalid = structuredClone(seed) as unknown as { pages: { tr: { layout: Data[] } }[] }
    invalid.pages[0].tr.layout[0].layout = 'grid-9'
    expect(() => validateSeed(invalid, 'bad.json')).toThrow()
  })
  it('rejects media outside the media directory', async () => {
    await expect(safeMediaPath(resolve('content/seed'), '../legal/tr/eula.md')).rejects.toThrow('outside')
  })
  it('rejects symlink escapes, a linked media root, and oversized files', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'softmarket-media-'))
    const outside = await mkdtemp(resolve(tmpdir(), 'softmarket-outside-'))
    try {
      await mkdir(resolve(root, 'media'))
      await writeFile(resolve(outside, 'secret'), 'secret')
      await symlink(resolve(outside, 'secret'), resolve(root, 'media/link'))
      await expect(safeMediaPath(root, 'media/link')).rejects.toThrow('outside')
      await writeFile(resolve(root, 'media/large'), '')
      await truncate(resolve(root, 'media/large'), 25 * 1024 * 1024 + 1)
      await expect(safeMediaPath(root, 'media/large')).rejects.toThrow('25 MiB')
      await rm(resolve(root, 'media'), { recursive: true })
      await symlink(outside, resolve(root, 'media'))
      await expect(safeMediaPath(root, 'media/secret')).rejects.toThrow('symlink')
    } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }) }
  })
})
