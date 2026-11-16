import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn, unstable_noStore: vi.fn() }))
vi.mock('next/cache', () => nextCache)
const preview = vi.hoisted(() => ({ enabled: false }))
vi.mock('next/headers', () => ({ draftMode: async () => ({ isEnabled: preview.enabled }), headers: async () => new Headers() }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key, setRequestLocale: () => {} }))
vi.mock('@/components/sections/page-hero', () => ({ PageHero: () => null }))
vi.mock('@/components/sections/json-ld', () => ({ JsonLd: () => null }))
vi.mock('@/components/layout/set-alternates', () => ({ SetAlternates: () => null }))
vi.mock('@/lib/support', () => ({ getSupportSitemapEntries: async () => [] }))

/*
 * P3 on real (temporary) SQLite with all migrations. Payments mode needs env + settings + a buy edition; the live DB
 * is never touched. Covers: product detail commerce data per mode, public APIs (Local API, REST, GraphQL) never
 * returning commerce fields, sales legal pages (footer link, /yasal 404, sitemap) following the mode, and the
 * edition/site-settings revalidation hooks.
 */
let payload: Payload
let dir: string
const saved = { ...process.env }
const ENV = { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' }
const setSite = (commerce: Record<string, unknown>) => payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, data: { commerce } as never })
const PAYMENTS = {
  mode: 'payments', providers: { iyzico: { enabled: true } },
  vat: { try: { rule: 'rate', ratePercent: 20 }, usd: { rule: 'exempt' } },
}
const run = (q: string) => payload.db.drizzle.$client.execute(q)
let content: typeof import('../../src/lib/content')
let site: typeof import('../../src/lib/site')
const legalSlugs = ['mesafeli-satis-sozlesmesi', 'eula']

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p3-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  Object.assign(process.env, ENV)
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const { migrations } = await import('../../src/migrations')
  await payload.db.migrate({ migrations: migrations as unknown as NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations'] })
  content = await import('../../src/lib/content')
  site = await import('../../src/lib/site')

  const family = await payload.create({ collection: 'product-families', overrideAccess: true, locale: 'tr', data: { title: 'Aile', slug: 'aile', _status: 'published' } as never })
  const product = await payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'Ürün', slug: 'urun', family: family.id, _status: 'published' } as never })
  const make = (sku: string, extra: Record<string, unknown>) => payload.create({
    collection: 'editions', overrideAccess: true, locale: 'tr',
    data: { title: sku, sku, product: product.id, licenseType: 'perpetual', seats: 1, ...extra } as never,
  })
  await make('BUY-1', { saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 } })
  await make('QUOTE-1', {})
  // Validation refuses a priced-less buy edition; a stale/legacy row is simulated in SQL (fail-to-quote on read).
  await make('BUY-NOPRICE', {})
  await run(`UPDATE editions SET sale_mode = 'buy' WHERE sku = 'BUY-NOPRICE'`)
  // P7: `open` also needs the three marked, published, non-draft sales pages (pages.commerceLegal).
  const kinds: Record<string, string> = { 'mesafeli-satis-sozlesmesi': 'distanceSales', 'on-bilgilendirme-formu': 'preInformation', 'iade-ve-cayma': 'refund' }
  for (const slug of [...legalSlugs, 'on-bilgilendirme-formu', 'iade-ve-cayma']) {
    const layout = [{ blockType: 'richText', content: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [
      { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text: 'Reviewed legal text.', format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] },
    ] } } }]
    const legal = await payload.create({ collection: 'pages', overrideAccess: true, locale: 'tr', data: { title: slug, slug, pageType: 'legal', layout, _status: 'published', ...(kinds[slug] ? { commerceLegal: kinds[slug] } : {}) } as never })
    await payload.update({ collection: 'pages', id: legal.id, overrideAccess: true, locale: 'en', data: { title: slug, slug, layout: legal.layout, _status: 'published' } as never })
  }
  await payload.updateGlobal({
    slug: 'footer', overrideAccess: true, locale: 'tr',
    data: { legalLinks: legalSlugs.map((slug) => ({ link: { type: 'route', route: 'yasal_slug', routeParam: slug, label: slug } })) } as never,
  })
}, 240000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }); process.env = saved })
beforeEach(() => { Object.assign(process.env, ENV); preview.enabled = false })

const detail = () => content.getProductDetail('tr', 'aile', 'urun')

describe('product detail by mode', () => {
  it('no env capability: exact pre-P3 data, no commerce fields, no site-settings read', async () => {
    await setSite(PAYMENTS)
    delete process.env.PAYMENTS_ENABLED
    const spy = vi.spyOn(payload, 'findGlobal')
    const d = (await detail())!
    expect(d.commerce.editions.every((a) => a.kind === 'quote')).toBe(true)
    expect(d.commerce.heroPrimary).toBe('quote')
    for (const e of d.editions) expect(e).not.toHaveProperty('pricing')
    for (const e of d.editions) expect(e).not.toHaveProperty('saleMode')
    expect(spy.mock.calls.filter(([o]) => o.slug === 'site-settings')).toHaveLength(0)
    spy.mockRestore()
  })

  it.each(['TRUE', '1', ' true', 'true '])('non-exact env capability %j never reads the global', async (value) => {
    process.env.PAYMENTS_ENABLED = value
    const spy = vi.spyOn(payload, 'findGlobal')
    try {
      const d = (await detail())!
      expect(d.commerce.editions.every((a) => a.kind === 'quote')).toBe(true)
      expect(spy).not.toHaveBeenCalled()
    } finally { spy.mockRestore() }
  })

  it('global read failure falls back to quote without requesting privileged prices', async () => {
    const global = vi.spyOn(payload, 'findGlobal').mockRejectedValueOnce(new Error('DB unavailable'))
    const find = vi.spyOn(payload, 'find')
    try {
      const d = (await detail())!
      expect(d.commerce.editions.every((a) => a.kind === 'quote')).toBe(true)
      expect(find.mock.calls.find(([o]) => o.collection === 'editions')![0]).toMatchObject({ overrideAccess: false, user: null, draft: false })
    } finally { global.mockRestore(); find.mockRestore() }
  })

  it('site mode quote-only: quote everywhere, prices never read', async () => {
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    const find = vi.spyOn(payload, 'find')
    const d = (await detail())!
    expect(d.commerce.editions.every((a) => a.kind === 'quote')).toBe(true)
    const editionRead = find.mock.calls.find(([o]) => o.collection === 'editions')![0]
    expect(editionRead).toMatchObject({ overrideAccess: false, user: null })
    expect(editionRead.select).not.toHaveProperty('pricing')
    find.mockRestore()
  })

  it('payments mode: priced buy edition → buy, others quote; raw commerce fields are stripped', async () => {
    await setSite(PAYMENTS)
    const d = (await detail())!
    const bySku = Object.fromEntries(d.editions.map((e, i) => [e.sku, d.commerce.editions[i]!]))
    expect(bySku['BUY-1']).toMatchObject({ kind: 'buy', checkout: true, taxMode: 'inclusive' })
    expect((bySku['BUY-1'] as { prices: { currency: string; totalMinor: number }[] }).prices.map((p) => [p.currency, p.totalMinor])).toEqual([['TRY', 125000], ['USD', 4000]])
    expect(bySku['QUOTE-1']).toEqual({ kind: 'quote' })
    expect(bySku['BUY-NOPRICE']).toEqual({ kind: 'quote' })
    expect(d.commerce.heroPrimary).toBe('buy') // checkout is open (P5 flag on)
    for (const e of d.editions) expect(Object.keys(e)).not.toEqual(expect.arrayContaining(['pricing']))
  })

  it.each([
    ['provider disabled', { providers: { iyzico: { enabled: false } } }],
    ['no VAT rule', { vat: { try: { rule: null }, usd: { rule: null } } }],
  ])('payments mode but %s → quote', async (_, over) => {
    await setSite({ ...PAYMENTS, ...over, mode: 'quote-only' }) // validation blocks an invalid payments save; read-side fail-closed is covered in the pure matrix
    await payload.db.drizzle.$client.execute(`UPDATE site_settings SET commerce_mode = 'payments'`)
    const d = (await detail())!
    expect(d.commerce.editions.every((a) => a.kind === 'quote')).toBe(true)
  })
})

describe('draft/visual editor boundaries while prices are open', () => {
  it('anonymous and a draft cookie without staff get published product data; staff preview remains private', async () => {
    await setSite(PAYMENTS)
    const published = await detail()
    const id = published!.product.id
    await payload.update({ collection: 'products', id, overrideAccess: true, draft: true,
      data: { title: 'DRAFT-SECRET-P3' } as never })
    expect((await detail())!.product.title).not.toBe('DRAFT-SECRET-P3')
    preview.enabled = true
    const auth = vi.spyOn(payload, 'auth').mockResolvedValue({ user: null } as never)
    try {
      expect((await detail())!.product.title).not.toBe('DRAFT-SECRET-P3')
      auth.mockResolvedValue({ user: { id: 1, collection: 'users', roles: ['admin'] } } as never)
      const staff = (await detail())!
      expect(staff.product.title).toBe('DRAFT-SECRET-P3')
      expect(staff.editions.every((e) => !('pricing' in e) && !('saleMode' in e))).toBe(true)
    } finally { auth.mockRestore(); preview.enabled = false }
  })

  it('editions have no draft/unpublished variant; only the parent product has drafts', () => {
    expect(payload.collections.editions.config.versions).toBeFalsy()
  })

  it('invalid UI sentinel -1 cannot pass server field validation', async () => {
    const e = await payload.find({ collection: 'editions', where: { sku: { equals: 'BUY-1' } }, limit: 1 })
    await expect(payload.update({ collection: 'editions', id: e.docs[0]!.id, overrideAccess: true,
      data: { pricing: { tryMinor: -1 } } as never })).rejects.toMatchObject({ status: 400 })
  })
})

describe('public APIs never expose commerce fields', () => {
  beforeEach(async () => { await setSite(PAYMENTS) })
  const find = (select: Record<string, true>) => payload.find({ collection: 'editions', overrideAccess: false, user: null, depth: 0, select: { sku: true, ...select } as never })

  it('Local API (anonymous)', async () => {
    const r = await find({ saleMode: true, pricing: true })
    expect(r.docs.length).toBeGreaterThan(0)
    for (const d of r.docs) { expect(d).not.toHaveProperty('saleMode'); expect(d).not.toHaveProperty('pricing') }
    const g = await payload.findGlobal({ slug: 'site-settings', overrideAccess: false, user: null, depth: 0 })
    expect(JSON.stringify(g)).not.toMatch(/payments|iyzico|ratePercent|rateBasisPoints|quoteSince/)
  })

  it('REST (anonymous)', async () => {
    const { REST_GET } = await import('@payloadcms/next/routes')
    const config = (await import('../../src/payload.config')).default
    const get = (path: string[]) => REST_GET(config)(new Request(`http://127.0.0.1:3100/api/${path.join('/')}`), { params: Promise.resolve({ slug: path }) })
    const editions = await (await get(['editions'])).text()
    expect(editions).toContain('BUY-1')
    expect(editions).not.toMatch(/saleMode|pricing|tryMinor|usdMinor/)
    const globalRes = await (await get(['globals', 'site-settings'])).text()
    expect(globalRes).not.toMatch(/"mode"|iyzico|ratePercent|rateBasisPoints|quoteSince/)
  })

  it('GraphQL (anonymous)', async () => {
    const { GRAPHQL_POST } = await import('@payloadcms/next/routes')
    const config = (await import('../../src/payload.config')).default
    const res = await GRAPHQL_POST(config)(new Request('http://127.0.0.1:3100/api/graphql', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ Editions { docs { sku saleMode pricing { tryMinor usdMinor } } } SiteSetting { commerce { mode providers { iyzico { enabled } } } } }' }),
    }))
    const body = await res.text()
    expect(body).toContain('BUY-1') // the query really ran and returned editions
    expect(body).not.toContain('"errors"')
    expect(body).not.toMatch(/"tryMinor":\s*\d|"usdMinor":\s*\d|"saleMode":\s*"buy"|"mode":\s*"payments"|"enabled":\s*true/)
  })
})

describe('sales legal pages follow the mode', () => {
  const footer = async () => (await site.getFooterData('tr')).legal.map((l) => l.label)
  const sitemapUrls = async () => (await (await import('../../src/app/sitemap')).default()).map((e) => e.url)
  const legalPage = async (slug: string) => {
    const mod = await import('../../src/app/(frontend)/[locale]/yasal/[slug]/page')
    return mod.default({ params: Promise.resolve({ locale: 'tr', slug }) })
  }

  it('quote-only: footer link gone, /yasal 404, no sitemap entry; other legal pages unaffected', async () => {
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    expect(await footer()).toEqual(['eula'])
    await expect(legalPage('mesafeli-satis-sozlesmesi')).rejects.toMatchObject({ digest: expect.stringMatching(/404/) })
    await expect(legalPage('eula')).resolves.toBeTruthy()
    const urls = await sitemapUrls()
    expect(urls.some((u) => u.includes('mesafeli-satis-sozlesmesi'))).toBe(false)
    expect(urls.some((u) => u.includes('/yasal/eula'))).toBe(true)
  })

  it('filters same-origin absolute legal links in header and footer', async () => {
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    const url = 'http://127.0.0.1:3100/tr/yasal/iade-ve-cayma'
    const link = { type: 'external', url, label: 'Sales legal' }
    await payload.updateGlobal({ slug: 'header', overrideAccess: true, locale: 'tr', data: { cta: { link } } as never })
    await payload.updateGlobal({ slug: 'footer', overrideAccess: true, locale: 'tr', data: {
      columns: [{ title: 'Sales', links: [{ link }] }],
    } as never })
    expect((await site.getHeaderNav('tr')).cta).toBeNull()
    expect((await site.getFooterData('tr')).columns).toHaveLength(0)
  })

  it('a copied draft cookie cannot reveal closed legal pages, but authenticated staff preview can', async () => {
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    preview.enabled = true
    const auth = vi.spyOn(payload, 'auth').mockResolvedValue({ user: null } as never)
    try {
      await expect(legalPage('mesafeli-satis-sozlesmesi')).rejects.toMatchObject({ digest: expect.stringMatching(/404/) })
      auth.mockResolvedValue({ user: { id: 1, collection: 'users', roles: ['editor'] } } as never)
      await expect(legalPage('mesafeli-satis-sozlesmesi')).resolves.toBeTruthy()
    } finally { auth.mockRestore(); preview.enabled = false }
  })

  it('payments mode: link, page and sitemap entry appear', async () => {
    await setSite(PAYMENTS)
    expect(await footer()).toEqual(['mesafeli-satis-sozlesmesi', 'eula'])
    await expect(legalPage('mesafeli-satis-sozlesmesi')).resolves.toBeTruthy()
    expect((await sitemapUrls()).some((u) => u.includes('mesafeli-satis-sozlesmesi'))).toBe(true)
  })

  it('renamed field-marked legal pages stay out of route/absolute/reference navigation, sitemap and public routes', async () => {
    await setSite({ ...PAYMENTS, mode: 'quote-only' })
    const original = (await payload.find({ collection: 'pages', where: { commerceLegal: { equals: 'refund' } } })).docs[0]!
    await payload.update({ collection: 'pages', id: original.id, locale: 'tr', data: { slug: 'yeni-iade' } })
    await payload.update({ collection: 'pages', id: original.id, locale: 'en', data: { slug: 'new-refund' } })
    try {
      const links = [
        { type: 'route', route: 'yasal_slug', routeParam: 'yeni-iade', label: 'route' },
        { type: 'external', url: 'http://127.0.0.1:3100/en/legal/%6eew-refund?x=1', label: 'absolute' },
        { type: 'internal', reference: { relationTo: 'pages', value: original.id }, label: 'reference' },
      ]
      await payload.updateGlobal({ slug: 'footer', locale: 'tr', data: { columns: [{ title: 'Sales', links: links.map((link) => ({ link })) }] } as never })
      await payload.updateGlobal({ slug: 'header', locale: 'tr', data: { cta: { link: links[2] } } as never })
      expect((await site.getFooterData('tr')).columns).toEqual([])
      expect((await site.getHeaderNav('tr')).cta).toBeNull()
      await expect(legalPage('yeni-iade')).rejects.toMatchObject({ digest: expect.stringMatching(/404/) })
      expect((await sitemapUrls()).some((u) => /yeni-iade|new-refund/.test(u))).toBe(false)
      await setSite(PAYMENTS)
      expect((await site.getFooterData('tr')).columns[0]?.links.map((l) => l.label)).toEqual(['route', 'absolute', 'reference'])
      expect((await site.getHeaderNav('tr')).cta?.label).toBe('reference')
    } finally {
      await payload.update({ collection: 'pages', id: original.id, locale: 'tr', data: { slug: 'iade-ve-cayma' } })
      await payload.update({ collection: 'pages', id: original.id, locale: 'en', data: { slug: 'iade-ve-cayma' } })
    }
  })

  it('no env capability: closed again even though the stored mode is payments', async () => {
    await setSite(PAYMENTS)
    delete process.env.PAYMENTS_ENABLED
    expect(await footer()).toEqual(['eula'])
    await expect(legalPage('mesafeli-satis-sozlesmesi')).rejects.toMatchObject({ digest: expect.stringMatching(/404/) })
  })
})

describe('revalidation', () => {
  it('saving an edition or site-settings revalidates the whole site layout (ISR refresh)', async () => {
    nextCache.revalidatePath.mockClear()
    const e = await payload.find({ collection: 'editions', overrideAccess: true, where: { sku: { equals: 'BUY-1' } }, limit: 1 })
    process.env.NEXT_RUNTIME = 'nodejs'
    await payload.update({ collection: 'editions', id: e.docs[0]!.id, overrideAccess: true, data: { pricing: { taxMode: 'inclusive', tryMinor: 130000, usdMinor: 4000 } } as never })
    expect(nextCache.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    await setSite(PAYMENTS)
    nextCache.revalidatePath.mockClear()
    const off = await setSite({ ...PAYMENTS, mode: 'quote-only' })
    expect(off.commerce?.quoteSince).toBeTruthy()
    expect(nextCache.revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(nextCache.revalidatePath).toHaveBeenCalledWith('/sitemap.xml')
    expect(nextCache.revalidateTag).toHaveBeenCalledWith('public-sitemap')
    delete process.env.NEXT_RUNTIME
  })
})
