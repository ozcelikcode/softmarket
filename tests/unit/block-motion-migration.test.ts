import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import * as migration from '../../src/migrations/20261108_100715_blocks_motion'

/*
 * V1-S migration (plan-visual-editor §V1, rule 6): `up` only ADDs the seven `motion_*` columns to every
 * block table (with the field defaults, so existing rows read as `auto` = the pre-V1 look); `down` only
 * drops those columns. Runs on a throwaway SQLite file migrated up to the previous migration.
 */

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const NAME = '20261108_100715_blocks_motion'
const COLUMNS = ['motion_delay', 'motion_duration', 'motion_easing', 'motion_mobile', 'motion_preset', 'motion_stagger', 'motion_trigger']

let payload: Payload
let dir: string
const run = (sql: string) => payload.db.drizzle.$client.execute(sql)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-v1-motion-'))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'v1-motion-migration-test-only-secret'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = await import('../../src/migrations')
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBeGreaterThan(0)
  type Migrations = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as Migrations })
  // Legacy content: a published page with a hero (animation none) and a feature grid, plus its version.
  await run("INSERT INTO pages(id,_status) VALUES(901,'published')")
  await run("INSERT INTO pages_locales(_parent_id,_locale,title,slug) VALUES(901,'tr','Korunan','korunan'),(901,'en','Preserved','preserved')")
  await run("INSERT INTO pages_blocks_hero(id,_order,_parent_id,_path,appearance_animation,appearance_theme) VALUES('hero-1',1,901,'layout','none','dark')")
  await run("INSERT INTO pages_blocks_hero_locales(_parent_id,_locale,heading) VALUES('hero-1','tr','Başlık'),('hero-1','en','Heading')")
  await run("INSERT INTO pages_blocks_feature_grid(id,_order,_parent_id,_path,appearance_animation) VALUES('grid-1',2,901,'layout','subtle')")
  await run("INSERT INTO _pages_v(id,parent_id,version__status) VALUES(901,901,'published')")
  await run("INSERT INTO _pages_v_blocks_hero(id,_order,_parent_id,_path,appearance_animation) VALUES(901,1,901,'version.layout','none')")
}, 60000)

afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

it('up only adds motion columns with defaults; down drops exactly those and preserves every row', async () => {
  const source = readFileSync(join(process.cwd(), `src/migrations/${NAME}.ts`), 'utf8')
  const [up, down] = source.split('export async function down')
  expect(up).not.toMatch(/\b(?:DROP|DELETE|INSERT|UPDATE|RENAME)\b|__new_|CREATE TABLE/i)
  expect(down).not.toMatch(/DROP TABLE|DELETE|INSERT|UPDATE|RENAME|__new_|CREATE TABLE/i)
  const ups = [...up.matchAll(/ALTER TABLE \\`([^\\]+)\\` ADD \\`([^\\]+)\\`/g)].map((m) => `${m[1]}.${m[2]}`)
  const downs = [...down.matchAll(/ALTER TABLE \\`([^\\]+)\\` DROP COLUMN \\`([^\\]+)\\`/g)].map((m) => `${m[1]}.${m[2]}`)
  expect(ups.length).toBe((up.match(/db\.run/g) ?? []).length)
  expect(downs.length).toBe((down.match(/db\.run/g) ?? []).length)
  expect(new Set(downs)).toEqual(new Set(ups))
  expect(new Set(ups.map((c) => c.split('.')[1]))).toEqual(new Set(COLUMNS))
  expect(ups).toHaveLength(1134)
  // Every block table of pages/products/solutions/case-studies/product-families (+ _v) gets all seven.
  expect(ups.length % COLUMNS.length).toBe(0)

  const tables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
  const expectedTables = tables.filter((t) => /_blocks_/.test(t) && !t.endsWith('_locales') && !t.endsWith('_rels'))
    .filter((t) => /_blocks_(hero|feature_grid|media_text|spec_table|stats|logo_wall|cta|faq|rich_text|video_embed|media|testimonial|tabs|product_families|product_showcase|solutions_grid|case_study|news_list)$/.test(t))
  expect(new Set(ups.map((c) => c.split('.')[0]))).toEqual(new Set(expectedTables))
  const rows = async () => Promise.all(tables.map(async (t) => (await run(`SELECT * FROM "${t}" ORDER BY rowid`)).rows))
  const before = await rows()

  await migration.up(args())
  const hero = (await run("SELECT * FROM pages_blocks_hero WHERE id='hero-1'")).rows[0]
  expect(hero).toMatchObject({ appearance_animation: 'none', appearance_theme: 'dark', motion_preset: 'auto', motion_trigger: 'scroll', motion_duration: 'base', motion_delay: '0', motion_easing: 'soft', motion_stagger: 'tight', motion_mobile: 0 })
  expect((await run("SELECT motion_preset FROM pages_blocks_feature_grid WHERE id='grid-1'")).rows[0].motion_preset).toBe('auto')
  expect((await run('SELECT motion_preset FROM _pages_v_blocks_hero WHERE id=901')).rows[0].motion_preset).toBe('auto')
  expect((await run('PRAGMA integrity_check')).rows[0].integrity_check).toBe('ok')
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  await run("UPDATE pages_blocks_feature_grid SET motion_preset='slide-left' WHERE id='grid-1'")

  await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
  expect(await rows()).toEqual(before)
  await migration.up(args())
  expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
}, 120000)

it('rejects unsafe hero presets through Local API even for drafts/autosaves', async () => {
  for (const draft of [false, true]) {
    for (const preset of ['fade', 'zoom-in', 'stagger', 'unknown']) {
      await expect(payload.create({ collection: 'pages', locale: 'tr', draft, data: {
        title: 'Motion', slug: `motion-${preset}`, _status: draft ? 'draft' : 'published',
        layout: [{ blockType: 'hero', heading: 'Hero', motion: { preset } }],
      } as never })).rejects.toMatchObject({ status: 400 })
    }
  }
  const page = await payload.create({ collection: 'pages', locale: 'tr', data: {
    title: 'Safe', slug: 'safe-motion', layout: [{ blockType: 'hero', heading: 'Hero', motion: { preset: 'slide-up' } }],
  } })
  await expect(payload.update({ collection: 'pages', id: page.id, locale: 'tr', draft: true, autosave: true,
    data: { layout: [{ blockType: 'hero', heading: 'Hero', motion: { preset: 'fade' } }] } as never,
  })).rejects.toMatchObject({ status: 400 })
}, 30000)

it('enforces the same hero allowlist in the installed REST and MCP handlers', async () => {
  const admin = await payload.create({ collection: 'users', data: { email: 'motion@example.test', password: 'Motion-test-only-123!', roles: ['admin'] } })
  const user = { ...admin, collection: 'users' as const }
  const data = { title: 'Motion', slug: 'handler-motion', layout: [{ blockType: 'hero', heading: 'Hero', motion: { preset: 'fade' } }] }
  const req = await createLocalReq({ user }, payload)
  req.routeParams = { collection: 'pages' }
  req.query = { draft: 'true' }
  req.data = data
  const { createHandler } = await import(resolve('node_modules/payload/dist/collections/endpoints/create.js'))
  await expect(createHandler(req)).rejects.toMatchObject({ status: 400 })

  // Register the actual installed MCP resource tool and invoke its captured callback with root fields.
  const { createResourceTool } = await import(resolve('node_modules/@payloadcms/plugin-mcp/dist/mcp/tools/resource/create.js'))
  let create: (params: unknown) => Promise<{ content: { text: string }[] }> = async () => { throw new Error('Tool not registered') }
  const server = { registerTool: (name: string, _schema: unknown, callback: typeof create) => { expect(name).toBe('createPages'); create = callback } }
  const mcpReq = await createLocalReq({ user }, payload) as PayloadRequest
  createResourceTool(server, mcpReq, user, false, 'pages', { pages: { enabled: true } }, {
    type: 'object', properties: { title: { type: 'string' }, slug: { type: 'string' }, layout: { type: 'array', items: { type: 'object' } } },
  })
  const before = (await payload.count({ collection: 'pages' })).totalDocs
  const response = await create({ ...data, locale: 'tr', draft: true })
  expect(response.content[0].text).toMatch(/Error creating resource/)
  expect((await payload.count({ collection: 'pages' })).totalDocs).toBe(before)
}, 30000)
