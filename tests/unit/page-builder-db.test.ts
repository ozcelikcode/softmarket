import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/*
 * F6 on real SQLite: `page_builder_pages` up() is additive and its hand-written down() keeps every row;
 * content/seed/05-pages.json imports idempotently; home resolution order, draft/template privacy,
 * reserved slugs, unique system keys and the home page delete trigger hold through Payload.
 */
const NAME = '20261107_144850_page_builder_pages'
let payload: Payload
let dir: string
let content: typeof import('../../src/lib/content')
const run = (q: string) => payload.db.drizzle.$client.execute(q)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
let migration: Migration

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f6-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  migration = migrations[index]
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  // Pre-F6 rows: settings (+locales/social/legal link), a legal page with blocks, product CTA (+ version).
  for (const q of [
    `INSERT INTO pages(id,page_type,_status) VALUES(1,'legal','published')`,
    `INSERT INTO pages_locales(title,slug,_locale,_parent_id) VALUES('KVKK','kvkk','tr',1)`,
    `INSERT INTO pages_blocks_hero(_order,_parent_id,_path,id,variant) VALUES(1,1,'layout','hero-1','minimal')`,
    `INSERT INTO pages_blocks_hero_locales(heading,id,_locale,_parent_id) VALUES('Merhaba',1,'tr','hero-1')`,
    `INSERT INTO site_settings(id,contact_phone,legal_kvkk_id) VALUES(1,'+90 212 000 00 00',1)`,
    `INSERT INTO site_settings_locales(site_name,_locale,_parent_id) VALUES('Legacy','tr',1)`,
    `INSERT INTO site_settings_social(_order,_parent_id,id,platform,url) VALUES(1,1,'social-1','linkedin','https://www.linkedin.com/company/x')`,
    `INSERT INTO products(id) VALUES(1)`,
    `INSERT INTO products_blocks_cta(_order,_parent_id,_path,id,style) VALUES(1,1,'layout','cta-1','banner')`,
    `INSERT INTO _products_v(id,parent_id,version__status) VALUES(1,1,'published')`,
    `INSERT INTO _products_v_blocks_cta(_order,_parent_id,_path,id) VALUES(1,1,'version.layout',1)`,
  ]) await run(q)
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe(`migration ${NAME}`, () => {
  it('up() only creates/adds (no DROP, DELETE FROM, rebuild); down() rebuilds nothing', () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')
    const [up, down] = code.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA/)
    expect(up.match(/ALTER TABLE \\`[^`\\]+\\` ADD /g)?.length).toBe(185)
    expect(down).not.toMatch(/__new_|PRAGMA|INSERT INTO|DROP TABLE \\`(site_settings|pages|_pages_v|products|product_families)\\`;/)
  })

  it('up/down in a transaction keeps every pre-existing row; up is repeatable', async () => {
    const oldTables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
    const rows = async () => Promise.all(oldTables.map(async (table) => (await run(`SELECT * FROM "${table}" ORDER BY rowid`)).rows))
    const before = await rows()
    await migration.up(args())
    expect((await run(`SELECT appearance_separator, style FROM products_blocks_cta`)).rows).toEqual([{ appearance_separator: 'none', style: 'banner' }])
    expect((await run(`SELECT aside FROM pages_blocks_hero`)).rows).toEqual([{ aside: 'media' }])
    // New objects are writable, then removed by down() together with the F6 columns only.
    await run(`UPDATE site_settings SET home_page_id=1 WHERE id=1`)
    await run(`UPDATE pages SET system_key='about' WHERE id=1`)
    await run(`INSERT INTO pages_blocks_listing(_order,_parent_id,_path,id) VALUES(2,1,'layout','listing-1')`)
    await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
    expect(await rows()).toEqual(before)
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
    await migration.up(args())
    await run(`UPDATE pages SET page_type='legal', system_key=NULL WHERE id=1`)
  }, 60000)
})

describe('F6 pages through Payload', () => {
  // F8 adds `_pages_v.autosave` (independent of F6): applied for writes through the current config.
  beforeAll(async () => {
    const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
    await migrations.find((m) => m.name === '20261107_190342_pages_autosave')!.up(args())
  })
  const seed = JSON.parse(readFileSync(resolve('content/seed/05-pages.json'), 'utf8'))
  const importSeed = async (dryRun = false) => {
    const { importContent } = await import('../../src/lib/content-import/importer')
    return importContent({
      payload, root: resolve('content/seed'), dryRun, markdown: (text) => ({ root: { text } }), log: () => {},
      sources: [
        { file: '05-pages.json', seed },
        { file: 'settings.json', seed: { version: 1, globals: { 'site-settings': { tr: { siteName: 'SoftMarket', homePage: 'home' }, en: { siteName: 'SoftMarket', homePage: 'home' } } } } },
      ],
    })
  }

  it('imports the home + system pages; a second run creates nothing and changes nothing', async () => {
    expect(await importSeed(true)).toEqual({ creates: 10, updates: 0 })
    expect(await importSeed()).toEqual({ creates: 10, updates: 0 })
    const snapshot = JSON.stringify((await run(`SELECT * FROM pages_blocks_hero ORDER BY id`)).rows)
    expect(await importSeed()).toEqual({ creates: 0, updates: 10 })
    expect(JSON.stringify((await run(`SELECT * FROM pages_blocks_hero ORDER BY id`)).rows)).toBe(snapshot)
    const home = await payload.find({ collection: 'pages', where: { slug: { equals: 'home' } }, locale: 'en', depth: 0, overrideAccess: true })
    expect(home.docs[0].layout?.map((b) => b.blockType)).toEqual(['hero', 'productFamilies', 'solutionsGrid', 'logoWall', 'caseStudy', 'newsList', 'cta'])
    expect(home.docs[0].layout?.[0]).toMatchObject({ aside: 'families', heading: 'Simple software for complex work.' })
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })
    expect(settings.homePage).toBe(home.docs[0].id)
    content = await import('../../src/lib/content')
  }, 120000)

  it('home resolution: SiteSettings.homePage -> slug "home" -> null; drafts never reach anonymous readers', async () => {
    const home = (await content.getHomePage('tr'))!
    expect(home.slug).toBe('home')
    const alt = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, data: { title: 'Alternatif', slug: 'alternatif', _status: 'published', layout: [{ blockType: 'spacer' }] } as never })
    await payload.updateGlobal({ slug: 'site-settings', data: { homePage: alt.id }, overrideAccess: true })
    expect((await content.getHomePage('tr'))?.id).toBe(alt.id)
    // A draft-only configured page is skipped (anonymous, published-only read) -> slug "home".
    const draft = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, draft: true, data: { title: 'Taslak', slug: 'taslak-ana', _status: 'draft' } as never })
    await payload.updateGlobal({ slug: 'site-settings', data: { homePage: draft.id }, overrideAccess: true })
    expect((await content.getHomePage('tr'))?.id).toBe(home.id)
    // A draft saved over the published home keeps the published blocks for visitors.
    await payload.update({ collection: 'pages', id: home.id, locale: 'tr', draft: true, overrideAccess: true, data: { layout: [{ blockType: 'spacer' }], _status: 'draft' } as never })
    expect((await content.getHomePage('tr'))?.layout?.map((b) => b.blockType)).toContain('productFamilies')
    // Deleting the configured page clears the setting (trigger) instead of failing on the foreign key.
    await payload.updateGlobal({ slug: 'site-settings', data: { homePage: alt.id }, overrideAccess: true })
    await payload.delete({ collection: 'pages', id: alt.id, overrideAccess: true })
    expect((await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })).homePage ?? null).toBeNull()
    // Unpublished home -> no CMS home (fallback composition).
    await payload.update({ collection: 'pages', id: home.id, locale: 'tr', overrideAccess: true, data: { _status: 'draft' } as never })
    expect(await content.getHomePage('tr')).toBeNull()
    await payload.update({ collection: 'pages', id: home.id, locale: 'tr', overrideAccess: true, data: { _status: 'published' } as never })
    expect((await content.getHomePage('tr'))?.id).toBe(home.id)
  }, 60000)

  it('templates are private, landing pages public, reserved slugs and duplicate system keys rejected', async () => {
    const template = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, data: { title: 'Şablon', slug: 'sablon', pageType: 'template', _status: 'published' } as never })
    const anon = { overrideAccess: false, user: null, draft: false } as const
    expect((await payload.find({ collection: 'pages', where: { slug: { equals: 'sablon' } }, ...anon })).docs).toHaveLength(0)
    expect((await payload.find({ collection: 'pages', where: { slug: { equals: 'sablon' } }, overrideAccess: true })).docs).toHaveLength(1)
    expect(await content.getLandingPage('tr', 'sablon')).toBeNull()
    await payload.delete({ collection: 'pages', id: template.id, overrideAccess: true })

    await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, data: { title: 'Kampanya', slug: 'kampanya', pageType: 'landing', _status: 'published' } as never })
    expect((await content.getLandingPage('tr', 'kampanya'))?.title).toBe('Kampanya')
    await expect(payload.create({ collection: 'pages', locale: 'en', overrideAccess: true, data: { title: 'X', slug: 'products', pageType: 'landing' } as never })).rejects.toThrow(/Slug/)
    await expect(payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, data: { title: 'X', slug: 'yeni-haberler', systemKey: 'news' } as never })).rejects.toThrow()
    // System page records may use route-like slugs (they are not served at /<slug>).
    expect((await content.getSystemPage('tr', 'news'))?.slug).toBe('haberler')
    expect((await content.getSystemPage('en', 'products'))?.hero).toMatchObject({ title: 'Products' })
  }, 60000)
})
