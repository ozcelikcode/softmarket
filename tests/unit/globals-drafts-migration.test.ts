import { createHash } from 'node:crypto'
import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import { migrations } from '../../src/migrations'
import * as revert from '../../src/migrations/20261118_142532_revert_globals_chrome_drafts'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const TIMEOUT = 240_000
const NAME = '20261118_142532_revert_globals_chrome_drafts'
const revertIndex = migrations.findIndex(({ name }) => name === NAME)
type MigrationList = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']

let payload: Payload
let dir: string
const run = (sql: string) => payload.db.drizzle.$client.execute(sql)
const inTx = (direction: 'up' | 'down') => payload.db.drizzle.transaction(
  async (db) => revert[direction]({ db, payload, req: {} } as never),
)
const schema = async () => (await run(
  "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
)).rows.map(({ type, name, tbl_name, sql }) => ({
  type, name, tbl_name, sql: typeof sql === 'string' ? sql.replace(/\n[ \t]+/g, '\n') : sql,
}))
const isVersionTable = (name: unknown) => /^_(header|footer)_v(_|$)/.test(String(name))
const columns = async (table: string) => (await run(`PRAGMA table_info("${table}")`)).rows

async function contentHashes() {
  const tables = (await schema()).filter(({ type, name }) => type === 'table' && /^(header|footer)(_|$)/.test(String(name)))
  return Object.fromEntries(await Promise.all(tables.map(async ({ name }) => {
    const projection = (await columns(String(name)))
      .filter((column) => column.name !== '_status').map((column) => `"${column.name}"`).join(', ')
    const { rows } = await run(`SELECT ${projection} FROM "${name}" ORDER BY rowid`)
    return [name, createHash('sha256').update(JSON.stringify(rows)).digest('hex')]
  })))
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-g1-revert-'))
  const dbPath = join(dir, 'test.db')
  process.env.DATABASE_URI = `file:${dbPath}`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  const main = (await run('PRAGMA database_list')).rows.find((row) => row.name === 'main')
  expect(realpathSync(String(main?.file))).toBe(realpathSync(dbPath))
  expect(revertIndex).toBeGreaterThan(0)
  await payload.db.migrate({ migrations: migrations.slice(0, revertIndex) as unknown as MigrationList })

  for (const sql of [
    `INSERT INTO header(id, updated_at, _status, announcement_enabled)
      VALUES(1, '2026-11-18T10:00:00.000Z', 'published', 1)`,
    `INSERT INTO header_locales(announcement_text, _locale, _parent_id)
      VALUES('Turkish announcement', 'tr', 1), ('English announcement', 'en', 1)`,
    `INSERT INTO header_nav_items(id, _order, _parent_id, link_type, link_route)
      VALUES('nav-1', 1, 1, 'route', 'urunler')`,
    `INSERT INTO header_nav_items_locales(link_label, _locale, _parent_id)
      VALUES('Turkish label', 'tr', 'nav-1'), ('English label', 'en', 'nav-1')`,
    `INSERT INTO footer(id, updated_at, _status, show_contact)
      VALUES(1, '2026-11-18T10:00:00.000Z', 'published', 0)`,
    `INSERT INTO footer_locales(copyright, _locale, _parent_id)
      VALUES('© {year} TR', 'tr', 1), ('© {year} EN', 'en', 1)`,
    `INSERT INTO footer_columns(id, _order, _parent_id) VALUES('col-1', 1, 1)`,
    `INSERT INTO footer_columns_locales(title, _locale, _parent_id)
      VALUES('English column', 'en', 'col-1'), (NULL, 'tr', 'col-1')`,
  ]) await run(sql)
}, TIMEOUT)

afterAll(async () => {
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

it.each([
  ['header', '1', '2026-11-18T10:00:00.001Z'],
  ['footer', 'NULL', '2026-11-18T10:00:00.001Z'],
  // The latest marker alone is enough, even when the draft is not newer than the main row.
  ['header', '1', '2026-11-18T09:00:00.000Z'],
])('refuses a pending %s draft before changing data or schema (latest = %s, updated_at = %s)', async (slug, latest, updatedAt) => {
  const table = `_${slug}_v`
  await run(`INSERT INTO ${table}(id, version__status, updated_at, latest)
    VALUES(1, 'draft', '${updatedAt}', ${latest})`)
  await run(`INSERT INTO ${table}_locales(_locale, _parent_id) VALUES('en', 1)`)
  try {
    const before = await schema()
    const hashes = await contentHashes()
    const draft = (await run(`SELECT * FROM ${table}`)).rows
    const localizedDraft = (await run(`SELECT * FROM ${table}_locales`)).rows

    await expect(inTx('up')).rejects.toThrow(revert.UP_REFUSED)

    expect(await schema()).toEqual(before)
    expect(await contentHashes()).toEqual(hashes)
    expect((await run(`SELECT * FROM ${table}`)).rows).toEqual(draft)
    expect((await run(`SELECT * FROM ${table}_locales`)).rows).toEqual(localizedDraft)
  } finally {
    await run(`DELETE FROM ${table}_locales WHERE _parent_id = 1`)
    await run(`DELETE FROM ${table} WHERE id = 1`)
  }
}, TIMEOUT)

it('applies the full chain, preserves main rows, and restores the G1 schema on down', async () => {
  // Superseded history is safe to drop. Related rows exercise the child-first table order.
  await run(`INSERT INTO _header_v(id, version__status, updated_at, latest)
    VALUES(1, 'draft', '2026-11-18T09:00:00.000Z', 0), (2, 'published', '2026-11-18T10:00:00.000Z', 1)`)
  await run(`INSERT INTO _header_v_locales(_locale, _parent_id) VALUES('en', 2)`)
  const before = await schema()
  const hashes = await contentHashes()
  expect(before.filter(({ type, name }) => type === 'table' && isVersionTable(name))).toHaveLength(22)

  await expect(inTx('down')).rejects.toThrow('G1 objects already exist')
  expect(await schema()).toEqual(before)

  await payload.db.migrate({ migrations: migrations as unknown as MigrationList })
  expect(await contentHashes()).toEqual(hashes)
  const after = await schema()
  expect(after.filter(({ tbl_name }) => isVersionTable(tbl_name))).toEqual([])
  expect(after.filter(({ name }) => name === 'header__status_idx' || name === 'footer__status_idx')).toEqual([])
  expect(after.filter(({ tbl_name }) => tbl_name === 'footer_columns_locales'))
    .toEqual(before.filter(({ tbl_name }) => tbl_name === 'footer_columns_locales'))
  for (const slug of ['header', 'footer']) {
    expect(await columns(slug)).not.toContainEqual(expect.objectContaining({ name: '_status' }))
  }
  expect((await run('PRAGMA integrity_check')).rows).toEqual([{ integrity_check: 'ok' }])
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  expect((await run('SELECT name FROM payload_migrations ORDER BY id')).rows.map(({ name }) => name))
    .toEqual(migrations.map(({ name }) => name))
  for (const locale of ['tr', 'en'] as const) {
    const header = await payload.findGlobal({ slug: 'header', locale, depth: 0, overrideAccess: false, user: null })
    expect(header.announcement?.text).toBe(locale === 'tr' ? 'Turkish announcement' : 'English announcement')
    const footer = await payload.findGlobal({ slug: 'footer', locale, depth: 0, overrideAccess: false, user: null })
    expect(footer.copyright).toBe(locale === 'tr' ? '© {year} TR' : '© {year} EN')
  }

  await inTx('down')
  expect(await schema()).toEqual(before)
  expect(await contentHashes()).toEqual(hashes)
  for (const slug of ['header', 'footer']) {
    expect((await run(`SELECT _status FROM ${slug}`)).rows).toEqual([{ _status: 'published' }])
  }

  await inTx('up')
  expect(await schema()).toEqual(after)
  expect(await contentHashes()).toEqual(hashes)
}, TIMEOUT)
