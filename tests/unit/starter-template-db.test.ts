import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/*
 * F10 starter template on an ISOLATED empty SQLite (temp dir, all migrations): content/templates/starter
 * imports without errors, is idempotent, and produces a working site: neutral globals, home page with blocks,
 * the 9 system pages, one sample family/product/edition, and no legal pages. The live DB is never opened.
 */
const ROOT = resolve('content/templates/starter')
const SYSTEM_KEYS = ['products', 'solutions', 'news', 'customers', 'careers', 'partners', 'support', 'contact', 'about']
let payload: Payload
let dir: string

const importStarter = async (dryRun = false) => {
  const { importContent, loadSources } = await import('../../src/lib/content-import/importer')
  const { withImportTransaction } = await import('../../src/lib/content-import/transaction')
  const { createLocalReq } = await import('payload')
  const { convertMarkdownToLexical, defaultEditorConfig, sanitizeServerEditorConfig } = await import('@payloadcms/richtext-lexical')
  const editorConfig = await sanitizeServerEditorConfig(defaultEditorConfig, payload.config)
  const req = await createLocalReq({}, payload)
  const sources = await loadSources(ROOT)
  // Match the CLI: run real validation/hooks and writes, then roll back for --dry-run.
  return withImportTransaction(payload, req, () => importContent({
    payload, root: ROOT, rollbackRun: dryRun, req,
    markdown: (markdown) => convertMarkdownToLexical({ editorConfig, markdown }), log: () => {}, sources,
  }), { rollback: dryRun })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f10-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await payload.db.drizzle.$client.execute('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: unknown[] }
  await payload.db.migrate({ migrations: migrations as never })
  // The commerce forms are created by `pnpm ensure-forms` in real installs; a minimal pair is enough here.
  for (const kind of ['quote', 'demo']) {
    await payload.create({ collection: 'forms', overrideAccess: true, data: { title: `softmarket-${kind}`, fields: [], confirmationType: 'message', confirmationMessage: { root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'paragraph', version: 1, direction: null, format: '', indent: 0, children: [{ type: 'text', version: 1, text: 'OK', format: 0, mode: 'normal', style: '', detail: 0 }] }] } } } as never })
  }
}, 180000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('content/templates/starter on an empty database', () => {
  it('runs against an empty DB: dry run rolls back, real run creates, rerun duplicates nothing', async () => {
    expect((await payload.count({ collection: 'pages', overrideAccess: true })).totalDocs).toBe(0)
    const dry = await importStarter(true)
    expect(dry.creates).toBeGreaterThan(10)
    expect((await payload.count({ collection: 'pages', overrideAccess: true })).totalDocs).toBe(0)
    const first = await importStarter()
    expect(first).toEqual({ creates: dry.creates, updates: 0 })
    const second = await importStarter()
    expect(second.creates).toBe(0)
    expect((await payload.count({ collection: 'pages', overrideAccess: true })).totalDocs).toBe(10)
    expect((await payload.count({ collection: 'products', overrideAccess: true })).totalDocs).toBe(1)
    expect((await payload.count({ collection: 'product-families', overrideAccess: true })).totalDocs).toBe(1)
    expect((await payload.count({ collection: 'editions', overrideAccess: true })).totalDocs).toBe(1)
  }, 180000)

  it('produces a site: home + 9 system pages published, no legal pages, neutral globals', async () => {
    const pages = await payload.find({ collection: 'pages', locale: 'tr', depth: 0, limit: 50, overrideAccess: true })
    expect(pages.docs.map((p) => p.pageType).filter((t) => t === 'legal' || t === 'template')).toEqual([])
    expect(pages.docs.map((p) => p.systemKey).filter(Boolean).sort()).toEqual([...SYSTEM_KEYS].sort())
    expect(pages.docs.every((p) => p._status === 'published')).toBe(true)

    const content = await import('../../src/lib/content')
    const home = await content.getHomePage('tr')
    expect(home?.layout?.map((b) => b.blockType)).toEqual(['hero', 'productFamilies', 'cta'])
    expect((await content.getHomePage('en'))?.title).toBe('Home')
    for (const key of SYSTEM_KEYS) {
      for (const locale of ['tr', 'en'] as const) expect((await content.getSystemPage(locale, key as never))?.slug, `${key}/${locale}`).toBeTruthy()
    }
    const families = await content.getFamilies('tr')
    expect(families.map((f) => f.slug)).toEqual(['ornek-aile'])

    const header = await payload.findGlobal({ slug: 'header', locale: 'en', depth: 0, overrideAccess: true })
    expect(header.navItems?.length).toBeGreaterThan(0)
    const footer = await payload.findGlobal({ slug: 'footer', depth: 0, overrideAccess: true })
    expect(footer.legalLinks ?? []).toEqual([])
    const settings = await payload.findGlobal({ slug: 'site-settings', locale: 'tr', depth: 0, overrideAccess: true })
    expect(settings.siteName).toBe('Şirket Adı')
    expect(settings.homePage).toBe(home?.id)
    expect(JSON.stringify([header, footer, settings])).not.toMatch(/SoftMarket Yazılım|\+90 212/)
  }, 120000)

  it('has a licence-ready sample edition (stable SKU) and published product', async () => {
    const editions = await payload.find({ collection: 'editions', depth: 1, overrideAccess: true })
    expect(editions.docs[0]).toMatchObject({ sku: 'STARTER-ORNEK-URUN', licenseType: 'subscription', durationMonths: 12 })
    const products = await payload.find({ collection: 'products', locale: 'en', depth: 0, overrideAccess: true })
    expect(products.docs[0]).toMatchObject({ title: 'Sample Product', _status: 'published' })
  })

  it('documents that rerunning starter overwrites matching installed content, while dry-run preserves it', async () => {
    const home = (await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, depth: 0 })).docs[0]
    await payload.update({ collection: 'pages', id: home.id, locale: 'tr', data: { title: 'Kurulu site', _status: 'published' } })
    await payload.updateGlobal({ slug: 'site-settings', locale: 'tr', data: { siteName: 'Kurulu şirket' } })
    await importStarter(true)
    expect((await payload.findByID({ collection: 'pages', id: home.id, locale: 'tr', depth: 0 })).title).toBe('Kurulu site')
    expect((await payload.findGlobal({ slug: 'site-settings', locale: 'tr', depth: 0 })).siteName).toBe('Kurulu şirket')
    await importStarter()
    expect((await payload.findByID({ collection: 'pages', id: home.id, locale: 'tr', depth: 0 })).title).toBe('Ana sayfa')
    expect((await payload.findGlobal({ slug: 'site-settings', locale: 'tr', depth: 0 })).siteName).toBe('Şirket Adı')
  }, 180000)
})
