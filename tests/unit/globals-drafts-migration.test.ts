import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * G1 `globals_chrome_drafts` on a temporary SQLite migrated up to the previous migration, with legacy header/footer rows.
 * - up() is additive except the guarded rebuild of `footer_columns_locales` (title NOT NULL -> nullable), which runs
 *   only while that table is empty; with rows it throws before any statement and nothing changes.
 * - up/down/up keeps every pre-existing row (hash-equal), backfills `_status = 'published'`, and down() refuses while an
 *   unpublished draft exists in the version tables.
 */
const NAME = '20261117_133332_globals_chrome_drafts'
let payload: Payload
let dir: string
let migration: typeof import('../../src/migrations/20261117_133332_globals_chrome_drafts')
const run = (query: string) => payload.db.drizzle.$client.execute(query)
const inTx = (fn: 'up' | 'down') => payload.db.drizzle.transaction(async (db) => migration[fn]({ db, payload, req: {} } as never))
const names = async (type: 'table' | 'index') =>
  (await run(`SELECT name FROM sqlite_master WHERE type='${type}' AND name NOT LIKE 'sqlite_%' ORDER BY name`)).rows.map((r) => String(r.name))
const schema = async () => (await run(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`)).rows
  .map((r) => `${r.type}:${r.name}:${r.sql}`)

let oldTables: string[]
/** Every row of the pre-migration tables, restricted to their original columns, as one hash per table. */
let oldColumns: Record<string, string[]>
const rowHashes = async () => Object.fromEntries(await Promise.all(oldTables.map(async (table) => {
  const cols = oldColumns[table]!.map((c) => `"${c}"`).join(',')
  const rows = (await run(`SELECT ${cols} FROM "${table}" ORDER BY rowid`)).rows
  return [table, createHash('sha256').update(JSON.stringify(rows)).digest('hex')] as const
})))

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-g1-migration-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === NAME)
  // Later migrations (e.g. L1 licensing_core) may follow; this test only runs the chain up to G1.
  expect(index).toBeGreaterThan(0)
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  migration = await import('../../src/migrations/20261117_133332_globals_chrome_drafts')
  // Legacy chrome: TR/EN menu with children, CTA, announcement, utility link, footer legal links and an (untitled) column.
  for (const q of [
    `INSERT INTO header(id, announcement_enabled) VALUES(1, 1)`,
    `INSERT INTO header_locales(cta_link_label, announcement_text, _locale, _parent_id) VALUES('Demo İste', 'Duyuru', 'tr', 1), ('Request a demo', 'News', 'en', 1)`,
    `INSERT INTO header_nav_items(_order, _parent_id, id, link_type, link_route, mega_menu) VALUES(1, 1, 'nav-1', 'route', 'urunler', 'products'), (2, 1, 'nav-2', 'route', 'destek', NULL)`,
    `INSERT INTO header_nav_items_locales(link_label, _locale, _parent_id) VALUES('Ürünler', 'tr', 'nav-1'), ('Products', 'en', 'nav-1'), ('Destek', 'tr', 'nav-2'), ('Support', 'en', 'nav-2')`,
    `INSERT INTO header_nav_items_children(_order, _parent_id, id, link_type, link_route) VALUES(1, 'nav-2', 'child-1', 'route', 'destek')`,
    `INSERT INTO header_nav_items_children_locales(link_label, description, _locale, _parent_id) VALUES('SSS', 'Sorular', 'tr', 'child-1'), ('FAQ', 'Questions', 'en', 'child-1')`,
    `INSERT INTO header_utility_links(_order, _parent_id, id, link_type, link_route) VALUES(1, 1, 'util-1', 'route', 'iletisim')`,
    `INSERT INTO footer(id, show_contact) VALUES(1, 0)`,
    `INSERT INTO footer_locales(copyright, _locale, _parent_id) VALUES('© {year}', 'tr', 1), ('© {year} EN', 'en', 1)`,
    `INSERT INTO footer_columns(_order, _parent_id, id) VALUES(1, 1, 'col-1')`,
    `INSERT INTO footer_legal_links(_order, _parent_id, id, link_type, link_route, link_route_param) VALUES(1, 1, 'legal-1', 'route', 'yasal_slug', 'eula')`,
    `INSERT INTO footer_legal_links_locales(link_label, _locale, _parent_id) VALUES('EULA', 'tr', 'legal-1'), ('EULA', 'en', 'legal-1')`,
  ]) await run(q)
  oldTables = await names('table')
  oldColumns = Object.fromEntries(await Promise.all(oldTables.map(async (t) =>
    [t, (await run(`PRAGMA table_info("${t}")`)).rows.map((r) => String(r.name))] as const)))
}, 240000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('SQL: up is CREATE/ALTER ADD/CREATE INDEX/backfill UPDATE plus only the guarded footer_columns_locales rebuild', () => {
  const source = readFileSync(join(__dirname, `../../src/migrations/${NAME}.ts`), 'utf8')
  const code = source.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n')
  const [up, down] = code.split('export async function down')
  const statements = [...up!.matchAll(/sql`([A-Z]+(?: [A-Z]+)?)/g)].map((m) => m[1])
  expect(new Set(statements)).toEqual(new Set(['SELECT COUNT', 'CREATE TABLE', 'CREATE INDEX', 'CREATE UNIQUE', 'DROP TABLE', 'ALTER TABLE', 'UPDATE']))
  expect(up).not.toMatch(/DELETE FROM|INSERT INTO|PRAGMA|DROP INDEX|DROP COLUMN/)
  expect([...up!.matchAll(/DROP TABLE \\`([a-z_]+)\\`/g)].map((m) => m[1])).toEqual(['footer_columns_locales'])
  expect([...up!.matchAll(/__new_([a-z_]+)/g)].every((m) => m[1] === 'footer_columns_locales')).toBe(true)
  expect([...up!.matchAll(/ALTER TABLE \\`([a-z_]+)\\` ADD \\`([a-z_]+)\\`/g)].map((m) => `${m[1]}.${m[2]}`)).toEqual(['header._status', 'footer._status'])
  expect([...up!.matchAll(/UPDATE \\`([a-z_]+)\\` SET \\`_status\\` = 'published'/g)].map((m) => m[1])).toEqual(['header', 'footer'])
  // The emptiness guard comes before the first statement that changes anything.
  expect(up!.indexOf('FOOTER_REBUILD_REFUSED)')).toBeLessThan(up!.indexOf('CREATE TABLE'))
  expect(down).not.toMatch(/__new_|INSERT INTO|PRAGMA|DELETE FROM|NOT NULL,\n/)
  expect(down).toContain('DOWN_REFUSED')
})

it('with rows in footer_columns_locales up() refuses before any change', async () => {
  await run(`INSERT INTO footer_columns_locales(title, _locale, _parent_id) VALUES('Kolon', 'tr', 'col-1')`)
  const before = await schema()
  const hashes = await rowHashes()
  await expect(inTx('up')).rejects.toThrow(migration.FOOTER_REBUILD_REFUSED)
  expect(await schema()).toEqual(before)
  expect(await rowHashes()).toEqual(hashes)
  await run(`DELETE FROM footer_columns_locales`)
}, 240000)

it('empty: up/down/up keeps every pre-existing row, backfills published, and keeps the public chrome', async () => {
  const hashes = await rowHashes()
  const indexes = await names('index')
  await inTx('up')
  expect(await rowHashes()).toEqual(hashes)
  expect((await run(`SELECT (SELECT _status FROM header) AS h, (SELECT _status FROM footer) AS f`)).rows[0]).toMatchObject({ h: 'published', f: 'published' })
  const added = (await names('table')).filter((t) => !oldTables.includes(t))
  expect(added).toHaveLength(22)
  expect(added.every((t) => /^_(header|footer)_v(_|$)/.test(t))).toBe(true)
  expect((await run(`PRAGMA table_info(footer_columns_locales)`)).rows.find((r) => r.name === 'title')).toMatchObject({ notnull: 0 })
  expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  for (const locale of ['tr', 'en'] as const) {
    const header = await payload.findGlobal({ slug: 'header', locale, depth: 0, overrideAccess: false, user: null })
    expect(header._status).toBe('published')
    expect(header.navItems?.map((n) => n.link?.label)).toEqual(locale === 'tr' ? ['Ürünler', 'Destek'] : ['Products', 'Support'])
    const footer = await payload.findGlobal({ slug: 'footer', locale, depth: 0, overrideAccess: false, user: null })
    expect(footer).toMatchObject({ _status: 'published', showContact: false, legalLinks: [{ link: { route: 'yasal_slug', routeParam: 'eula', label: 'EULA' } }] })
  }
  expect(Number((await run('SELECT COUNT(*) AS n FROM _header_v')).rows[0]?.n)).toBe(0)

  // A pending (unpublished) draft lives only in the version tables: down refuses and changes nothing.
  await payload.updateGlobal({ slug: 'header', locale: 'tr', draft: true, overrideAccess: true, data: { announcement: { enabled: true, text: 'Taslak duyuru' } } as never })
  const withDraft = await schema()
  await expect(inTx('down')).rejects.toThrow(migration.DOWN_REFUSED)
  expect(await schema()).toEqual(withDraft)
  // Publishing the same content as before resolves the draft; the main row keeps its legacy values.
  await payload.updateGlobal({ slug: 'header', locale: 'tr', overrideAccess: true, data: { announcement: { enabled: true, text: 'Duyuru' }, _status: 'published' } as never })

  await inTx('down')
  expect((await names('table'))).toEqual(oldTables)
  expect((await names('index')).filter((i) => !indexes.includes(i))).toEqual([])
  expect((await run(`PRAGMA table_info(header)`)).rows.some((r) => r.name === '_status')).toBe(false)
  // Publishing rewrote the header rows (same values, new row ids for array locales): compare the untouched tables
  // and the header content separately.
  const after = await rowHashes()
  for (const table of oldTables.filter((t) => !t.startsWith('header'))) expect(after[table], table).toBe(hashes[table])
  const content = async () => (await run(`SELECT l._locale, l.link_label, i.id, i.link_route FROM header_nav_items i JOIN header_nav_items_locales l ON l._parent_id = i.id ORDER BY i._order, l._locale`)).rows
  expect(await content()).toEqual([
    { _locale: 'en', link_label: 'Products', id: 'nav-1', link_route: 'urunler' }, { _locale: 'tr', link_label: 'Ürünler', id: 'nav-1', link_route: 'urunler' },
    { _locale: 'en', link_label: 'Support', id: 'nav-2', link_route: 'destek' }, { _locale: 'tr', link_label: 'Destek', id: 'nav-2', link_route: 'destek' },
  ])
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])

  await inTx('up')
  expect((await run(`SELECT _status FROM footer`)).rows[0]).toMatchObject({ _status: 'published' })
  expect((await names('table')).filter((t) => !oldTables.includes(t))).toEqual(added)
}, 240000)
