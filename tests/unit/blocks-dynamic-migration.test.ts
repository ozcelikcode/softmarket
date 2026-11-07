import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let payload: Payload
let dir: string
let migration: typeof import('../../src/migrations/20261107_130000_blocks_dynamic_set')
const run = (query: string) => payload.db.drizzle.$client.execute(query)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
const roots = ['products', 'solutions', 'case_studies', 'pages']

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-f5-migration-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === '20261107_130000_blocks_dynamic_set')
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  migration = await import('../../src/migrations/20261107_130000_blocks_dynamic_set')
  for (const root of roots) {
    await run(`INSERT INTO "${root}"(id) VALUES(1)`)
    await run(`INSERT INTO "_${root}_v"(id,parent_id) VALUES(1,1)`)
    for (const prefix of [root, `_${root}_v`]) {
      const id = prefix.startsWith('_') ? '1' : "'legacy-logo'"
      await run(`INSERT INTO "${prefix}_blocks_logo_wall"(_order,_parent_id,_path,id,source) VALUES(1,1,'layout',${id},'manual')`)
      for (const locale of ['tr', 'en'])
        await run(`INSERT INTO "${prefix}_blocks_logo_wall_locales"(heading,_locale,_parent_id) VALUES('Legacy ${locale}','${locale}',${id})`)
    }
  }
}, 60000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('F5 up/down in a transaction preserves every pre-existing table row, including localized version blocks', async () => {
  const oldTables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
  const rows = async () => Promise.all(oldTables.map(async (table) => (await run(`SELECT * FROM "${table}" ORDER BY rowid`)).rows))
  const before = await rows()
  await migration.up(args())
  for (const root of roots) for (const prefix of [root, `_${root}_v`]) {
    expect((await run(`SELECT "limit" FROM "${prefix}_blocks_logo_wall"`)).rows[0].limit).toBe(12)
    const id = prefix.startsWith('_') ? '1' : "'new-block'"
    await run(`INSERT INTO "${prefix}_blocks_product_families"(_order,_parent_id,_path,id) VALUES(2,1,'layout',${id})`)
    await run(`INSERT INTO "${prefix}_blocks_product_families_locales"(heading,_locale,_parent_id) VALUES('F5','tr',${id})`)
  }
  await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
  expect(await rows()).toEqual(before)
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  await migration.up(args())
  expect((await run("SELECT name FROM sqlite_master WHERE name='_case_studies_v_blocks_product_showcase'")).rows).toHaveLength(1)
}, 60000)
