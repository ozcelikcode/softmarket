import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import * as migration from '../../src/migrations/20261108_093334_v0_payload_393'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let payload: Payload
let dir: string
const run = (sql: string) => payload.db.drizzle.$client.execute(sql)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-v0-migration-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'v0-migration-test-only-secret'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === '20261108_093334_v0_payload_393')
  expect(index).toBeGreaterThan(0)
  type Migrations = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as Migrations })
  await run("INSERT INTO users(id,email,api_key,api_key_index) VALUES(901,'legacy@example.test','encrypted-key','key-index')")
  await run("INSERT INTO customers(id,email,name) VALUES(901,'customer@example.test','Legacy customer')")
  await run("INSERT INTO users_sessions(id,_parent_id,_order,expires_at) VALUES('old-session',901,1,'2030-01-01')")
  await run('INSERT INTO products(id) VALUES(901)')
  await run("INSERT INTO products_locales(_parent_id,_locale,title,slug) VALUES(901,'tr','Korunan','korunan'),(901,'en','Preserved','preserved')")
  await run('INSERT INTO _products_v(id,parent_id) VALUES(901,901)')
  for (const [table, id] of [['products_blocks_hero', "'old-block'"], ['_products_v_blocks_hero', '901']]) {
    await run(`INSERT INTO ${table}(id,_order,_parent_id,_path) VALUES(${id},1,901,'layout')`)
    await run(`INSERT INTO ${table}_locales(_parent_id,_locale,heading) VALUES(${id},'tr','Başlık'),(${id},'en','Heading')`)
  }
}, 60000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('only adds two auth columns and parent indexes; down removes exactly those additions', async () => {
  const source = readFileSync(join(process.cwd(), 'src/migrations/20261108_093334_v0_payload_393.ts'), 'utf8')
  const [up, down] = source.split('export async function down')
  expect(up).not.toMatch(/\b(?:DROP|DELETE)\b|__new_/i)
  expect(down).not.toMatch(/DROP TABLE|DELETE|__new_/i)
  const tables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
  const rows = async () => Promise.all(tables.map(async (t) => (await run(`SELECT * FROM "${t}" ORDER BY rowid`)).rows))
  const before = await rows()
  const indexes = async () => (await run("SELECT name,sql FROM sqlite_master WHERE type='index' ORDER BY name")).rows
  const oldIndexes = await indexes()
  await migration.up(args())
  for (const table of ['users', 'customers']) {
    expect((await run(`SELECT reset_password_requested_at FROM ${table} WHERE id=901`)).rows[0].reset_password_requested_at).toBeNull()
    await run(`UPDATE ${table} SET reset_password_requested_at='2026-11-08' WHERE id=901`)
  }
  expect((await indexes()).length - oldIndexes.length).toBe(309)
  expect((await run('PRAGMA integrity_check')).rows[0].integrity_check).toBe('ok')
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
  expect(await rows()).toEqual(before)
  expect(await indexes()).toEqual(oldIndexes)
  await migration.up(args())
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
}, 60000)
