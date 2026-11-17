import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('node:crypto', async (importOriginal) => {
  const crypto = await importOriginal<typeof import('node:crypto')>()
  return { ...crypto, randomBytes: vi.fn(crypto.randomBytes) }
})

/*
 * L1 `licensing_core` on a temporary SQLite migrated up to the previous migration, with existing licenses.
 * - up() is additive only (CREATE TABLE / CREATE INDEX / ALTER TABLE ADD + one backfill UPDATE of the new
 *   licenses.public_id column); up/down/up keeps every pre-existing row (hash-equal) and down restores the schema.
 * - The two hand-written partial unique indexes exist, reject a second ACTIVE row and accept inactive duplicates
 *   (docs/licensing/adr-l0.md V4: drizzle does not model them, so this test is the guard against silent loss).
 * - down() refuses before any change while licensing data/settings/metadata exist.
 */
const NAME = '20261117_200700_licensing_core'
let payload: Payload
let dir: string
let migration: typeof import('../../src/migrations/20261117_200700_licensing_core')
const run = (query: string) => payload.db.drizzle.$client.execute(query)
const inTx = (fn: 'up' | 'down') => payload.db.drizzle.transaction(async (db) => migration[fn]({ db, payload, req: {} } as never))
const names = async (type: 'table' | 'index') =>
  (await run(`SELECT name FROM sqlite_master WHERE type='${type}' AND name NOT LIKE 'sqlite_%' ORDER BY name`)).rows.map((r) => String(r.name))
const schema = async () => (await run(`SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`)).rows
  .map((r) => `${r.type}:${r.name}:${r.sql}`)

let oldTables: string[]
let oldSchema: string[]
let oldColumns: Record<string, string[]>
const rowHashes = async () => Object.fromEntries(await Promise.all(oldTables.map(async (table) => {
  const cols = oldColumns[table]!.map((c) => `"${c}"`).join(',')
  const rows = (await run(`SELECT ${cols} FROM "${table}" ORDER BY rowid`)).rows
  return [table, createHash('sha256').update(JSON.stringify(rows)).digest('hex')] as const
})))

const NEW_TABLES = [
  'license_activations', 'license_status_log', 'licensing_settings', 'licensing_settings_notifications_alert_emails',
  'licensing_settings_signing_keys', 'security_audit', 'security_audit_rels', 'security_blocks', 'security_events',
]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-l1-migration-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBeGreaterThan(0)
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  migration = await import('../../src/migrations/20261117_200700_licensing_core')
  for (const q of [
    `INSERT INTO customers(id, name, email) VALUES(1, 'Müşteri', 'c1@example.test')`,
    `INSERT INTO product_families(id) VALUES(1)`,
    `INSERT INTO products(id, family_id, _status) VALUES(1, 1, 'published')`,
    `INSERT INTO editions(id, sku, product_id, seats) VALUES(1, 'L1-SKU', 1, 3)`,
    `INSERT INTO licenses(id, key, customer_id, edition_id, product_id, starts_at, status, seats) VALUES
      (1, 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', 1, 1, 1, '2026-01-01T00:00:00.000Z', 'active', 3),
      (2, 'AAAAA-BBBBB-CCCCC-DDDDD-FFFFF', 1, 1, 1, '2026-01-01T00:00:00.000Z', 'suspended', 3),
      (3, 'AAAAA-BBBBB-CCCCC-DDDDD-GGGGG', 1, 1, 1, '2026-01-01T00:00:00.000Z', 'revoked', 1)`,
  ]) await run(q)
  oldTables = await names('table')
  oldSchema = await schema()
  oldColumns = Object.fromEntries(await Promise.all(oldTables.map(async (t) =>
    [t, (await run(`PRAGMA table_info("${t}")`)).rows.map((r) => String(r.name))] as const)))
}, 240000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('SQL: up is additive only; down has no rebuild and guards first', () => {
  const source = readFileSync(join(__dirname, `../../src/migrations/${NAME}.ts`), 'utf8')
  const code = source.split('\n').filter((line) => !/^\s*(\/\/|\/?\*)/.test(line)).join('\n')
  const [header, upAndDown] = code.split('export async function up')
  const [up, down] = upAndDown!.split('export async function down')
  const statements = [...up!.matchAll(/sql`([A-Z]+(?: [A-Z]+)?)/g)].map((m) => m[1])
  expect(new Set(statements)).toEqual(new Set(['CREATE TABLE', 'CREATE INDEX', 'CREATE UNIQUE', 'ALTER TABLE', 'SELECT', 'UPDATE']))
  expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|DROP COLUMN/)
  expect(header).not.toMatch(/DROP |DELETE|__new_|PRAGMA|INSERT/)
  // Every ALTER TABLE in up() adds a column.
  expect([...up!.matchAll(/ALTER TABLE \\`([a-z_]+)\\` ([A-Z]+)/g)].every((m) => m[2] === 'ADD')).toBe(true)
  expect([...up!.matchAll(/ALTER TABLE \\`([a-z_]+)\\` ADD \\`([a-z_]+)\\`/g)].map((m) => `${m[1]}.${m[2]}`).sort()).toEqual([
    '_products_v.version_licensing_code', '_products_v.version_licensing_enabled',
    'licenses.max_devices', 'licenses.public_id', 'licenses.status_changed_at', 'licenses.status_reason', 'licenses.status_source',
    'products.licensing_code', 'products.licensing_enabled',
  ])
  expect([...up!.matchAll(/CREATE TABLE \\`([a-z_]+)\\`/g)].map((m) => m[1]).sort()).toEqual(NEW_TABLES)
  // The only UPDATE is the backfill of the new column, and it runs before the unique index on it.
  expect([...up!.matchAll(/UPDATE \\`([a-z_]+)\\` SET \\`([a-z_]+)\\`/g)].map((m) => `${m[1]}.${m[2]}`)).toEqual(['licenses.public_id'])
  expect(up!.indexOf('randomBytes(12)')).toBeLessThan(up!.indexOf('licenses_public_id_idx'))
  expect(up).toContain('PARTIAL_INDEXES.license_activations_one_active_fp')
  expect(up).toContain('PARTIAL_INDEXES.license_activations_one_active_thumb')
  expect(down).not.toMatch(/__new_|INSERT INTO|RENAME|PRAGMA|DELETE FROM|CREATE TABLE|UPDATE /)
  expect(down!.indexOf('DOWN_REFUSED')).toBeLessThan(down!.indexOf('DROP'))
})

it('up/down/up keeps every row, backfills public ids, creates the partial indexes; down refuses while data exists', async () => {
  const hashes = await rowHashes()
  vi.mocked(randomBytes)
    .mockImplementationOnce(() => Buffer.alloc(12, 1))
    .mockImplementationOnce(() => Buffer.alloc(12, 1))
    .mockImplementationOnce(() => Buffer.alloc(12, 2))
    .mockImplementationOnce(() => Buffer.alloc(12, 3))
  await inTx('up')
  expect(await rowHashes()).toEqual(hashes)
  expect((await names('table')).filter((t) => !oldTables.includes(t))).toEqual(NEW_TABLES)
  const ids = (await run('SELECT public_id FROM licenses ORDER BY id')).rows.map((r) => String(r.public_id))
  expect(ids).toHaveLength(3)
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{24}$/)
  expect(ids).toEqual(['01', '02', '03'].map((byte) => byte.repeat(12)))
  expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])

  // Partial unique indexes: present with their WHERE clause.
  const partial = (await run(`SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='license_activations' AND sql LIKE '%WHERE%' ORDER BY name`)).rows
  expect(partial.map((r) => r.name)).toEqual(['license_activations_one_active_fp', 'license_activations_one_active_thumb'])
  for (const r of partial) expect(String(r.sql)).toMatch(/^CREATE UNIQUE INDEX .* WHERE `status` = 'active'$/)
  const insert = (id: number, status: string, fp: string, thumb: string) => run(`INSERT INTO license_activations
    (id, public_id, license_id, status, device_public_key, device_key_thumbprint, fingerprint_hash, activated_at)
    VALUES (${id}, 'act${id}', 1, '${status}', 'pk${id}', '${thumb}', '${fp}', '2026-11-17T00:00:00.000Z')`)
  await insert(1, 'active', 'fp-a', 'th-a')
  await expect(insert(2, 'active', 'fp-a', 'th-b')).rejects.toThrow(/UNIQUE/) // same license + fingerprint
  await expect(insert(3, 'active', 'fp-b', 'th-a')).rejects.toThrow(/UNIQUE/) // same device key
  await insert(4, 'deactivated', 'fp-a', 'th-a')
  await insert(5, 'revoked', 'fp-a', 'th-a')
  await insert(6, 'active', 'fp-b', 'th-b')

  // down refuses before any change while licensing data exists (each guard on its own).
  const guarded = [
    ['SELECT 1', 'DELETE FROM license_activations'],
    [`INSERT INTO licensing_settings(id) VALUES(1)`, 'DELETE FROM licensing_settings'],
    [`UPDATE products SET licensing_code = 'studio-pro'`, 'UPDATE products SET licensing_code = NULL'],
    [`INSERT INTO _products_v(parent_id, version_licensing_code) VALUES(1, 'draft-code')`, 'DELETE FROM _products_v'],
    [`UPDATE licenses SET max_devices = 1 WHERE id = 2`, 'UPDATE licenses SET max_devices = NULL'],
    [`UPDATE licenses SET status_reason = 'manual' WHERE id = 2`, 'UPDATE licenses SET status_reason = NULL'],
    [`INSERT INTO security_events(id, type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, triage)
      VALUES(1, 'api.replay', 'high', 'api', '2026-11-17', '2026-11-17', 1, 'k', 'open')`, 'DELETE FROM security_events'],
  ] as const
  for (const [arrange, cleanup] of guarded) {
    await run(arrange)
    const before = await schema()
    await expect(inTx('down')).rejects.toThrow(migration.DOWN_REFUSED)
    expect(await schema()).toEqual(before)
    await run(cleanup)
  }

  await inTx('down')
  expect(await schema()).toEqual(oldSchema)
  expect(await rowHashes()).toEqual(hashes)
  expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])

  await inTx('up')
  expect(await rowHashes()).toEqual(hashes)
  expect((await run(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('license_activations_one_active_fp', 'license_activations_one_active_thumb')`)).rows[0]).toMatchObject({ n: 2 })
}, 240000)
