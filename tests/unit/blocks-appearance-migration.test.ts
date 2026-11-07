import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Migration = { name: string; up: (args: never) => Promise<void>; down: (args: never) => Promise<void> }
let payload: Payload
let dir: string
let migration: Migration
const NAME = '20261107_110012_blocks_appearance'
const run = async (q: string) => payload.db.drizzle.$client.execute(q)
const columns = async (table: string) => (await run(`PRAGMA table_info("${table}")`)).rows.map((r) => String(r.name))
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-blocks-appearance-'))
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
  // Pre-F3 rows: a product body with a CTA (+ action) and a hero version row on the legacy `default` variant.
  for (const q of [
    'INSERT INTO products(id) VALUES(1)',
    "INSERT INTO products_blocks_cta(_order,_parent_id,_path,id,style) VALUES(1,1,'layout','cta-1','card')",
    "INSERT INTO products_blocks_cta_locales(heading,id,_locale,_parent_id) VALUES('Merhaba',1,'tr','cta-1')",
    "INSERT INTO products_blocks_cta_actions(_order,_parent_id,id,link_type,link_appearance) VALUES(1,'cta-1','act-1','external','primary')",
    "INSERT INTO _products_v(id,parent_id,version__status) VALUES(1,1,'published')",
    "INSERT INTO _products_v_blocks_hero(_order,_parent_id,_path,id,variant,_uuid) VALUES(1,1,'version.layout',1,'default','hero-1')",
  ]) await run(q)
  await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as unknown as MigrateArgs })
}, 60000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe(`migration ${NAME}`, () => {
  it('is additive and fills existing rows with the pre-F3 defaults', async () => {
    const cta = (await run('SELECT * FROM products_blocks_cta')).rows
    expect(cta).toHaveLength(1)
    expect(cta[0]).toMatchObject({ id: 'cta-1', style: 'card', appearance_theme: 'auto', appearance_spacing: 'md', appearance_align: 'center', appearance_width: 'normal', appearance_animation: 'subtle', appearance_anchor: null })
    expect(Number(cta[0].appearance_hidden)).toBe(0)
    expect((await run('SELECT count(*) AS n FROM products_blocks_cta_actions')).rows[0].n).toBe(1)
    expect((await run('SELECT heading FROM products_blocks_cta_locales')).rows[0].heading).toBe('Merhaba')
    const hero = (await run('SELECT variant, appearance_spacing, appearance_theme FROM _products_v_blocks_hero')).rows[0]
    expect(hero).toMatchObject({ variant: 'default', appearance_spacing: 'lg', appearance_theme: 'auto' })
    expect(await columns('pages_blocks_feature_grid')).toEqual(expect.arrayContaining(['style', 'appearance_theme', 'appearance_anchor', 'appearance_hidden']))
    expect(await columns('pages_blocks_rich_text')).not.toContain('appearance_width')
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  })

  it('reads legacy rows through Payload with resolved defaults', async () => {
    // Payload's schema now includes F4 tables/columns; apply that migration for the read and revert it after.
    const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
    const later = migrations.find((m) => m.name === '20261107_111754_blocks_static_set')!
    const dynamic = migrations.find((m) => m.name === '20261107_130000_blocks_dynamic_set')!
    await later.up(args())
    await dynamic.up(args())
    let product
    try {
      product = await payload.findByID({ collection: 'products', id: 1, locale: 'tr', depth: 0, overrideAccess: true })
    } finally {
      await dynamic.down(args())
      await later.down(args())
    }
    expect(product.layout?.[0]).toMatchObject({ blockType: 'cta', style: 'card', appearance: { theme: 'auto', spacing: 'md', align: 'center', hidden: false } })
  })

  it('down drops only the new columns and keeps the data; up is repeatable', async () => {
    await migration.down(args())
    const cols = await columns('products_blocks_cta')
    expect(cols.filter((c) => c.startsWith('appearance_'))).toEqual([])
    expect(await columns('products_blocks_feature_grid')).not.toContain('style')
    expect((await run('SELECT id, style FROM products_blocks_cta')).rows[0]).toMatchObject({ id: 'cta-1', style: 'card' })
    expect((await run('SELECT count(*) AS n FROM products_blocks_cta_actions')).rows[0].n).toBe(1)
    await migration.up(args())
    expect((await run('SELECT appearance_spacing FROM products_blocks_cta')).rows[0].appearance_spacing).toBe('md')
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  }, 120000)
})
