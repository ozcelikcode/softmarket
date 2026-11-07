import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/*
 * F7 `globals_editable`: up() only adds tables/columns; legacy header/footer/settings/CTA link rows
 * survive and still render; the hand-written down() drops only F7 objects (no __new_ rebuild,
 * which would cascade into locales/children/social rows inside the migration transaction).
 */
let payload: Payload
let dir: string
let migration: typeof import('../../src/migrations/20261107_141523_globals_editable')
const run = (query: string) => payload.db.drizzle.$client.execute(query)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f7-migration-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === '20261107_141523_globals_editable')
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  migration = await import('../../src/migrations/20261107_141523_globals_editable')
  // Legacy (pre-F7) rows: external "/tr/..." menu links, children, CTA, legal links, settings + social, product CTA.
  for (const q of [
    `INSERT INTO header(id) VALUES(1)`,
    `INSERT INTO header_locales(cta_link_url,cta_link_label,_locale,_parent_id) VALUES('/tr/demo-talep','Demo İste','tr',1)`,
    `INSERT INTO header_nav_items(_order,_parent_id,id,link_type,mega_menu) VALUES(1,1,'nav-1','external','products')`,
    `INSERT INTO header_nav_items_locales(link_url,link_label,_locale,_parent_id) VALUES('/tr/urunler','Ürünler','tr','nav-1')`,
    `INSERT INTO header_nav_items(_order,_parent_id,id,link_type) VALUES(2,1,'nav-2','external')`,
    `INSERT INTO header_nav_items_locales(link_label,_locale,_parent_id) VALUES('Şirket','tr','nav-2')`,
    `INSERT INTO header_nav_items_children(_order,_parent_id,id,link_type) VALUES(1,'nav-2','child-1','external')`,
    `INSERT INTO header_nav_items_children_locales(link_url,link_label,description,_locale,_parent_id) VALUES('/tr/kariyer','Kariyer','Ekibimize katılın.','tr','child-1')`,
    `INSERT INTO footer(id) VALUES(1)`,
    `INSERT INTO footer_legal_links(_order,_parent_id,id,link_type) VALUES(1,1,'legal-1','external')`,
    `INSERT INTO footer_legal_links_locales(link_url,link_label,_locale,_parent_id) VALUES('/tr/yasal/eula','EULA','tr','legal-1')`,
    `INSERT INTO site_settings(id,contact_phone) VALUES(1,'+90 212 000 00 00')`,
    `INSERT INTO site_settings_locales(site_name,_locale,_parent_id) VALUES('Legacy','tr',1)`,
    `INSERT INTO site_settings_social(_order,_parent_id,id,platform,url) VALUES(1,1,'social-1','linkedin','https://www.linkedin.com/company/x')`,
    `INSERT INTO products(id) VALUES(1)`,
    `INSERT INTO products_blocks_cta(_order,_parent_id,_path,id) VALUES(1,1,'layout','cta-1')`,
    `INSERT INTO products_blocks_cta_actions(_order,_parent_id,id,link_type) VALUES(1,'cta-1','act-1','external')`,
    `INSERT INTO products_blocks_cta_actions_locales(link_url,link_label,_locale,_parent_id) VALUES('/tr/teklif-iste','Teklif','tr','act-1')`,
    `INSERT INTO _products_v(id,parent_id,version__status) VALUES(1,1,'published')`,
    `INSERT INTO _products_v_blocks_cta(_order,_parent_id,_path,id) VALUES(1,1,'version.layout',1)`,
    `INSERT INTO _products_v_blocks_cta_actions(_order,_parent_id,id,link_type) VALUES(1,1,1,'external')`,
    `INSERT INTO _products_v_blocks_cta_actions_locales(link_url,link_label,_locale,_parent_id) VALUES('/tr/teklif-iste','Eski sürüm','tr',1)`,
  ]) await run(q)
}, 60000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('F7 up() is additive only (no DROP/DELETE/rebuild) and the generated destructive down() was replaced', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = await readFile(join(__dirname, '../../src/migrations/20261107_141523_globals_editable.ts'), 'utf8')
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n')
  const [up, down] = code.split('export async function down')
  expect(up).not.toMatch(/DROP |DELETE FROM|__new_|INSERT INTO|RENAME|PRAGMA/)
  expect(down).not.toMatch(/__new_|INSERT INTO|PRAGMA/)
  const dropped = [...down.matchAll(/DROP TABLE \\`([a-z_]+)\\`/g)].map((m) => m[1])
  expect(dropped.length).toBe(6)
  expect(dropped.every((t) => /^header_(nav_items_columns|utility_links)/.test(t))).toBe(true)
})

it('F7 up/down in a transaction preserves every pre-existing row; legacy links still resolve', async () => {
  const oldTables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
  const rows = async () => Promise.all(oldTables.map(async (table) => (await run(`SELECT * FROM "${table}" ORDER BY rowid`)).rows))
  const before = await rows()
  await migration.up(args())
  // Payload's schema also has the F6 columns (site_settings.home_page_id …): apply them for the reads.
  const { migrations } = await import('../../src/migrations')
  const pageBuilder = migrations.find((m) => m.name === '20261107_144850_page_builder_pages')!
  await pageBuilder.up(args() as never)
  const header = await payload.findGlobal({ slug: 'header', locale: 'tr', depth: 0, overrideAccess: true })
  expect(header.navItems?.[0]?.link).toMatchObject({ type: 'external', url: '/tr/urunler', label: 'Ürünler' })
  expect(header.navItems?.[1]?.children?.[0]).toMatchObject({ link: { url: '/tr/kariyer' }, description: 'Ekibimize katılın.' })
  expect(header.cta?.link).toMatchObject({ url: '/tr/demo-talep', label: 'Demo İste' })
  expect(header.announcement).toMatchObject({ enabled: false, dismissible: true })
  expect(header.utility).toMatchObject({ showSearch: true, showLanguage: true, showAccount: true })
  const settings = await payload.findGlobal({ slug: 'site-settings', locale: 'tr', depth: 0, overrideAccess: true })
  expect(settings).toMatchObject({ siteName: 'Legacy', motion: 'subtle', contact: { phone: '+90 212 000 00 00' } })
  expect(settings.social).toHaveLength(1)
  const footer = await payload.findGlobal({ slug: 'footer', locale: 'tr', depth: 0, overrideAccess: true })
  expect(footer).toMatchObject({ showContact: true, showSocial: true })
  expect(footer.legalLinks?.[0]?.link).toMatchObject({ type: 'external', url: '/tr/yasal/eula' })
  // New objects are writable, then removed by down() together with the F7 columns only.
  await run(`INSERT INTO header_nav_items_columns(_order,_parent_id,id) VALUES(1,'nav-2','col-1')`)
  await run(`INSERT INTO header_nav_items_columns_links(_order,_parent_id,id,link_type,link_route) VALUES(1,'col-1','cl-1','route','kariyer')`)
  await run(`INSERT INTO header_utility_links(_order,_parent_id,id,link_type,link_route) VALUES(1,1,'u-1','route','iletisim')`)
  await run(`UPDATE site_settings SET brand_accent='#0f766e', motion='none' WHERE id=1`)
  await payload.db.drizzle.transaction(async (db) => pageBuilder.down({ db, payload, req: {} } as never))
  await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
  expect(await rows()).toEqual(before)
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  await migration.up(args())
  expect((await run("SELECT name FROM sqlite_master WHERE name='header_nav_items_columns_links'")).rows).toHaveLength(1)
}, 60000)
