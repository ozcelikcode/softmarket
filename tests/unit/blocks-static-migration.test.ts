import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Migration = { name: string; up: (args: never) => Promise<void>; down: (args: never) => Promise<void> }
let payload: Payload
let dir: string
let migration: Migration
let deleteMigration: Migration
const NAME = '20261107_111754_blocks_static_set'
const run = async (q: string) => payload.db.drizzle.$client.execute(q)
const tables = async () => (await run("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => String(r.name))
const columns = async (table: string) => (await run(`PRAGMA table_info("${table}")`)).rows.map((r) => String(r.name))
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-blocks-static-'))
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
  deleteMigration = migrations.find((m) => m.name === '20261107_120000_hero_video_delete')!
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  for (const q of [
    'INSERT INTO pages(id) VALUES(1)',
    "INSERT INTO pages_blocks_hero(_order,_parent_id,_path,id,variant) VALUES(1,1,'layout','hero-1','minimal')",
    "INSERT INTO pages_blocks_hero_locales(heading,id,_locale,_parent_id) VALUES('Merhaba',1,'tr','hero-1')",
  ]) await run(q)
  await payload.db.migrate({ migrations: migrations.slice(0, index + 1) as unknown as MigrateArgs })
  // Payload's schema also contains the F5 tables; they are independent of F4, so keep them applied for reads.
  await migrations.find((m) => m.name === '20261107_130000_blocks_dynamic_set')!.up(args())
  // F7 adds link route columns to hero/CTA action tables (independent of F4): keep applied for reads.
  await migrations.find((m) => m.name === '20261107_141523_globals_editable')!.up(args())
  // F6 adds appearance/hero/page columns (independent of F4): keep applied for reads.
  await migrations.find((m) => m.name === '20261107_144850_page_builder_pages')!.up(args())
  // F8 adds `_pages_v.autosave` (independent of F4): keep applied for reads.
  await migrations.find((m) => m.name === '20261107_190342_pages_autosave')!.up(args())
}, 60000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe(`migration ${NAME}`, () => {
  it('up is additive: no DROP/DELETE/table rebuild', () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const up = source.slice(0, source.indexOf('export async function down'))
    expect(up).not.toMatch(/DROP TABLE|DROP INDEX|DELETE FROM|__new_|INSERT INTO|UPDATE `/)
  })
  it('creates block tables for the 5 new blocks in all 4 collections (+ versions) and keeps hero rows', async () => {
    const all = await tables()
    for (const root of ['pages', 'products', 'solutions', 'case_studies'])
      for (const slug of ['media', 'testimonial', 'tabs', 'spacer', 'divider']) {
        expect(all, `${root}_blocks_${slug}`).toContain(`${root}_blocks_${slug}`)
        expect(all).toContain(`_${root}_v_blocks_${slug}`)
      }
    expect(all).toContain('pages_blocks_media_items')
    expect(all).toContain('pages_blocks_tabs_items_locales')
    expect(await columns('pages_blocks_hero')).toContain('video_id')
    expect(await columns('_pages_v_blocks_hero')).toContain('video_id')
    expect((await run('SELECT variant, video_id FROM pages_blocks_hero')).rows[0]).toMatchObject({ variant: 'minimal', video_id: null })
    expect((await run('SELECT heading FROM pages_blocks_hero_locales')).rows[0].heading).toBe('Merhaba')
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
  })
  it('stores and reads the new blocks through Payload', async () => {
    await payload.update({
      collection: 'pages', id: 1, locale: 'tr', overrideAccess: true, draft: false,
      data: {
        title: 'QA', slug: 'qa',
        layout: [
          { blockType: 'hero', variant: 'mediaBackground', heading: 'H' },
          { blockType: 'tabs', heading: 'T', items: [{ label: 'A' }, { label: 'B' }] },
          { blockType: 'spacer', size: 'lg' },
          { blockType: 'divider', style: 'accent' },
          { blockType: 'testimonial', quote: 'Q', name: 'N' },
          { blockType: 'media', aspect: '16-9', items: [] },
        ],
      } as never,
    })
    const page = await payload.findByID({ collection: 'pages', id: 1, locale: 'tr', depth: 0, overrideAccess: true })
    expect(page.layout?.map((b) => b.blockType)).toEqual(['hero', 'tabs', 'spacer', 'divider', 'testimonial', 'media'])
    expect(page.layout?.[2]).toMatchObject({ size: 'lg', appearance: { spacing: 'none', theme: 'auto' } })
    expect(page.layout?.[0]).toMatchObject({ variant: 'mediaBackground' })
  })
  it('validates public video MIME and posters on server writes; anonymous reads never populate protected media', async () => {
    for (const [id, mime, protectedFile] of [
      [1001, 'image/png', false], [1002, 'video/mp4', false], [1003, 'video/mp4', true],
      [1004, 'application/pdf', false], [1005, 'application/video/mp4', false], [1006, 'video/quicktime', false],
    ] as const) {
      await run(`INSERT INTO media(id,filename,mime_type,protected,visibility) VALUES(${id},'fixture-${id}.${id === 1001 ? 'png' : 'mp4'}','${mime}',${protectedFile ? 1 : 0},'public')`)
      await run(`INSERT INTO media_locales(alt,_locale,_parent_id) VALUES('Fixture ${id}','tr',${id})`)
    }
    const save = (video: number, media: number | null = 1001) => payload.update({
      collection: 'pages', id: 1, locale: 'tr', overrideAccess: true, draft: false,
      data: { _status: 'published', layout: [{ blockType: 'hero', heading: 'H', variant: 'mediaBackground', media, video }] },
    })
    await save(1002)
    for (const id of [1001, 1003, 1004, 1005, 1006]) await expect(save(id)).rejects.toThrow()
    await expect(save(1002, null)).rejects.toThrow()
    // Simulate a legacy draft / a file whose protection changed after publication.
    await run('UPDATE pages_blocks_hero SET video_id=1003')
    const anon = await payload.findByID({ collection: 'pages', id: 1, locale: 'tr', depth: 2, overrideAccess: false, user: null })
    expect(JSON.stringify(anon)).not.toContain('fixture-1003')
    expect(anon.layout?.[0]).toMatchObject({ video: 1003 })
    await save(1002)
  })
  it('deleting a referenced background video clears the relation instead of failing', async () => {
    const roots = ['products', 'solutions', 'case_studies', 'pages']
    for (const root of roots) {
      await run(`INSERT INTO "${root}"(id) VALUES(987)`)
      await run(`INSERT INTO "_${root}_v"(id,parent_id) VALUES(987,987)`)
      for (const versioned of [false, true]) {
        const prefix = versioned ? `_${root}_v` : root
        const heroID = versioned ? '987' : `'${root}-legacy-hero'`
        const actionID = versioned ? '987' : `'${root}-legacy-action'`
        await run(`INSERT INTO "${prefix}_blocks_hero"(_order,_parent_id,_path,id,variant) VALUES(1,987,'layout',${heroID},'default')`)
        await run(`INSERT INTO "${prefix}_blocks_hero_actions"(_order,_parent_id,id) VALUES(1,${heroID},${actionID})`)
        for (const locale of ['tr', 'en']) {
          await run(`INSERT INTO "${prefix}_blocks_hero_locales"(heading,_locale,_parent_id) VALUES('Legacy ${locale}','${locale}',${heroID})`)
          await run(`INSERT INTO "${prefix}_blocks_hero_actions_locales"(link_label,link_url,_locale,_parent_id) VALUES('CTA ${locale}','/tr','${locale}',${actionID})`)
        }
      }
    }
    await deleteMigration.up(args())
    for (const root of roots) for (const prefix of [root, `_${root}_v`])
      await run(`UPDATE "${prefix}_blocks_hero" SET video_id=1002`)
    await expect(payload.delete({ collection: 'media', id: 1002, overrideAccess: true })).resolves.toMatchObject({ id: 1002 })
    for (const root of roots) for (const prefix of [root, `_${root}_v`])
      expect((await run(`SELECT video_id FROM "${prefix}_blocks_hero"`)).rows.every((r) => r.video_id === null)).toBe(true)
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
    await deleteMigration.down(args())
    expect((await run("SELECT name FROM sqlite_master WHERE name='hero_video_delete'")).rows).toEqual([])
  })
  it('down then up is repeatable', async () => {
    const roots = ['products', 'solutions', 'case_studies', 'pages']
    const children = roots.flatMap((root) => [root, `_${root}_v`].flatMap((prefix) => [
      `${prefix}_blocks_hero_locales`, `${prefix}_blocks_hero_actions`, `${prefix}_blocks_hero_actions_locales`,
    ]))
    const before = await Promise.all(children.map(async (table) => (await run(`SELECT * FROM "${table}"`)).rows))
    // Same transaction boundary as Payload migrateDown; PRAGMA foreign_keys=OFF cannot disable FK checks here.
    await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
    expect(await tables()).not.toContain('pages_blocks_tabs')
    expect(await columns('pages_blocks_hero')).not.toContain('video_id')
    expect((await run('SELECT id FROM pages_blocks_hero')).rows).toHaveLength(2)
    for (const [i, table] of children.entries()) expect((await run(`SELECT * FROM "${table}"`)).rows, table).toEqual(before[i])
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
    await migration.up(args())
    expect(await tables()).toContain('pages_blocks_tabs')
  }, 120000)
})
