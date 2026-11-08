import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Payload } from 'payload'
import type { Data, RecordInput } from '../../src/lib/content-import/schema'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * V2 on real (temporary) SQLite: `v2_product_bound_blocks` up() only creates tables/indexes and adds
 * `_products_v.autosave`; down() removes exactly those and keeps every pre-existing row. Through Payload:
 * bound blocks round-trip in TR/EN, the required "Teklif İste" (productEditions) block cannot be removed or
 * hidden on any write path (published, draft, autosave), and product autosaves only write `_products_v`.
 */
const NAME = '20261108_130717_v2_product_bound_blocks'
let payload: Payload
let dir: string
const run = (q: string) => payload.db.drizzle.$client.execute(q)
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
let migration: Migration
let rest: Migration[]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-v2-'))
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
  rest = migrations.slice(index + 1)
  type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  // Pre-V2 rows: a product with a legacy CTA block (+ its published version).
  for (const q of [
    `INSERT INTO product_families(id) VALUES(1)`,
    `INSERT INTO product_families_locales(title,slug,_locale,_parent_id) VALUES('Aile','aile','tr',1)`,
    `INSERT INTO products(id,family_id,_status) VALUES(1,1,'published')`,
    `INSERT INTO products_locales(title,slug,_locale,_parent_id) VALUES('Eski','eski','tr',1)`,
    `INSERT INTO products_blocks_cta(_order,_parent_id,_path,id,style) VALUES(1,1,'layout','cta-1','banner')`,
    `INSERT INTO _products_v(id,parent_id,version__status,latest) VALUES(1,1,'published',1)`,
    `INSERT INTO _products_v_blocks_cta(_order,_parent_id,_path,id) VALUES(1,1,'version.layout',1)`,
  ]) await run(q)
}, 120000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe(`migration ${NAME}`, () => {
  it('up() only creates tables/indexes and adds one column; down() only drops what up() created', () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|UPDATE `/)
    const statements = [...up.matchAll(/sql`(\w+ \w+)/g)].map((m) => m[1])
    expect(new Set(statements)).toEqual(new Set(['CREATE TABLE', 'CREATE INDEX', 'ALTER TABLE']))
    expect(up.match(/ALTER TABLE \\`_products_v\\` ADD \\`autosave\\` integer/g)).toHaveLength(1)
    const created = [...up.matchAll(/CREATE TABLE \\`(\w+)\\`/g)].map((m) => m[1])
    expect(created).toHaveLength(16)
    for (const t of created) expect(t).toMatch(/^_?products(_v)?_blocks_product_(hero|nav|overview|features|specs|editions|downloads|docs)$/)
    expect(down).not.toMatch(/__new_|INSERT INTO|RENAME/)
    expect([...down.matchAll(/DROP TABLE \\`(\w+)\\`/g)].map((m) => m[1]).sort()).toEqual([...created].sort())
    expect(down).toMatch(/ALTER TABLE \\`_products_v\\` DROP COLUMN \\`autosave\\`/)
  })

  it('up/down keep every pre-existing row; up again succeeds', async () => {
    const oldTables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
    const rows = async () => Promise.all(oldTables.map(async (table) => (await run(`SELECT * FROM "${table}" ORDER BY rowid`)).rows))
    const before = await rows()
    await migration.up(args())
    await run(`INSERT INTO products_blocks_product_editions(_order,_parent_id,_path,id) VALUES(2,1,'layout','ed-1')`)
    await run(`INSERT INTO _products_v_blocks_product_editions(_order,_parent_id,_path,id) VALUES(2,1,'version.layout',1)`)
    expect((await run(`SELECT appearance_theme, appearance_spacing, motion_preset FROM products_blocks_product_editions`)).rows[0])
      .toMatchObject({ appearance_theme: 'auto', appearance_spacing: 'lg', motion_preset: 'auto' })
    await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
    expect(await rows()).toEqual(before)
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
    await migration.up(args())
    type MigrateArgs = NonNullable<Parameters<typeof payload.db.migrate>[0]>['migrations']
    if (rest.length) await payload.db.migrate({ migrations: rest as unknown as MigrateArgs })
    expect((await run(`SELECT name FROM pragma_table_info('_products_v') WHERE name='autosave'`)).rows).toHaveLength(1)
  }, 60000)
})

describe('product-bound blocks through Payload', () => {
  const composed = [
    { blockType: 'productHero', motion: { preset: 'slide-up' } },
    { blockType: 'productFeatures', motion: { preset: 'fade' } },
    { blockType: 'productEditions', motion: { preset: 'slide-left' } },
    { blockType: 'productSpecs', showRequirements: false },
    { blockType: 'faq', items: [{ question: 'S?', answer: { root: { type: 'root', children: [] } } }] },
  ]
  let id: number
  const required = /zorunlu|required/

  it('legacy product reads with its old layout (compatibility mode stays)', async () => {
    const legacy = await payload.findByID({ collection: 'products', id: 1, locale: 'tr', depth: 0 })
    expect(legacy.layout?.map((b) => b.blockType)).toEqual(['cta'])
  })

  it('all eight bound tables round-trip through the live migration schema', async () => {
    const { PRODUCT_BOUND_BLOCKS } = await import('../../src/lib/blocks/product-composition')
    const layout = PRODUCT_BOUND_BLOCKS.map((blockType) => ({ blockType, motion: { preset: 'slide-right' },
      ...(blockType === 'productHero' || blockType === 'productEditions' ? {} : { appearance: { hidden: true } }),
    }))
    const doc = await payload.create({ collection: 'products', data: { title: 'All sections', family: 1, layout: layout as never } })
    const stored = await payload.findByID({ collection: 'products', id: doc.id, depth: 0 })
    expect(stored.layout?.map((b) => b.blockType)).toEqual([...PRODUCT_BOUND_BLOCKS])
    expect(stored.layout?.every((b) => 'motion' in b && b.motion?.preset === 'slide-right')).toBe(true)
    expect(stored.layout?.filter((b) => 'hidden' in (b.appearance ?? {}) && (b.appearance as { hidden?: boolean }).hidden)).toHaveLength(6)
  })

  it('creates/publishes a composition and round-trips block order and settings in TR and EN', async () => {
    const created = await payload.create({
      collection: 'products', locale: 'tr', draft: false,
      data: { title: 'V2 Ürün', family: 1, _status: 'published', layout: composed as never },
    })
    id = created.id
    await payload.update({ collection: 'products', id, locale: 'en', data: { title: 'V2 Product', _status: 'published' } })
    for (const locale of ['tr', 'en'] as const) {
      const doc = await payload.findByID({ collection: 'products', id, locale, depth: 0 })
      expect(doc.layout?.map((b) => b.blockType)).toEqual(composed.map((b) => b.blockType))
      const specs = doc.layout?.find((b) => b.blockType === 'productSpecs') as { showRequirements?: boolean }
      expect(specs.showRequirements).toBe(false)
      expect((doc.layout?.[2] as { motion?: { preset?: string } }).motion?.preset).toBe('slide-left')
    }
  })

  it('rejects removing the required editions/quote block on publish, draft save and autosave', async () => {
    const without = composed.filter((b) => b.blockType !== 'productEditions')
    const expectRejected = async (p: Promise<unknown>, message: RegExp = required) => {
      const error = (await p.then(() => null, (e: unknown) => e)) as { status?: number; data?: { errors?: { message: string }[] } } | null
      expect(error, 'write must be rejected').not.toBeNull()
      expect(error!.status).toBe(400)
      expect(error!.data?.errors?.map((e) => e.message).join(' ')).toMatch(message)
    }
    await expectRejected(payload.update({ collection: 'products', id, locale: 'tr', data: { layout: without as never, _status: 'published' } }))
    await expectRejected(payload.update({ collection: 'products', id, locale: 'tr', draft: true, data: { layout: without as never, _status: 'draft' } }))
    await expectRejected(payload.update({ collection: 'products', id, locale: 'tr', draft: true, autosave: true, data: { layout: without as never } }))
    // Hidden flag cannot be stored on it (no column); duplicates are rejected.
    await expectRejected(payload.update({ collection: 'products', id, locale: 'tr', draft: true, data: { layout: [...composed, { blockType: 'productEditions' }] as never } }), /bir kez|only once/)
    const stored = await payload.findByID({ collection: 'products', id, locale: 'tr', depth: 0 })
    expect(stored.layout?.map((b) => b.blockType)).toEqual(composed.map((b) => b.blockType))
  })

  it('moves a hero that was appended below other blocks to the front (publish, draft and autosave)', async () => {
    const hero = composed.find((b) => b.blockType === 'productHero')!
    const lowered = [...composed.filter((b) => b !== hero), hero]
    for (const opts of [{ _status: 'published' }, { draft: true, _status: 'draft' }, { draft: true, autosave: true }] as const) {
      const { _status, ...rest } = opts as { _status?: 'published' | 'draft'; draft?: boolean; autosave?: boolean }
      const updated = await payload.update({ collection: 'products', id, locale: 'tr', ...rest, data: { layout: lowered as never, ...(_status ? { _status } : {}) } })
      expect(updated.layout?.[0]?.blockType).toBe('productHero')
    }
    const stored = await payload.findByID({ collection: 'products', id, locale: 'tr', depth: 0 })
    expect(stored.layout?.map((b) => b.blockType)).toEqual(composed.map((b) => b.blockType))
  })

  it('a layout with the editions block moved elsewhere is accepted (movable, not removable)', async () => {
    const moved = [composed[0], composed[2], composed[1], composed[4]]
    const doc = await payload.update({ collection: 'products', id, locale: 'tr', data: { layout: moved as never, _status: 'published' } })
    expect(doc.layout?.map((b) => b.blockType)).toEqual(['productHero', 'productEditions', 'productFeatures', 'faq'])
    const ed = (await run(`SELECT * FROM products_blocks_product_editions WHERE _parent_id=${id}`)).rows[0]
    expect(Object.keys(ed)).not.toContain('appearance_hidden')
  })

  it('autosave writes only a draft version (main row stays published)', async () => {
    const versionsBefore = Number((await run(`SELECT count(*) AS n FROM _products_v WHERE parent_id=${id}`)).rows[0].n)
    await payload.update({ collection: 'products', id, locale: 'tr', draft: true, autosave: true, data: { title: 'V2 Taslak', layout: composed as never } })
    const main = (await run(`SELECT _status FROM products WHERE id=${id}`)).rows[0]
    expect(main._status).toBe('published')
    expect((await run(`SELECT title FROM products_locales WHERE _parent_id=${id} AND _locale='tr'`)).rows[0].title).toBe('V2 Ürün')
    const autosaved = (await run(`SELECT autosave, version__status FROM _products_v WHERE parent_id=${id} ORDER BY id DESC LIMIT 1`)).rows[0]
    expect(autosaved).toMatchObject({ autosave: 1, version__status: 'draft' })
    expect(Number((await run(`SELECT count(*) AS n FROM _products_v WHERE parent_id=${id}`)).rows[0].n)).toBeGreaterThan(versionsBefore)
  })

  it('rejects clearing every bound block, including EN, autosave, bulk and legacy version restore', async () => {
    const legacy = await payload.create({ collection: 'products', locale: 'tr', data: { title: 'Restore', family: 1, _status: 'published', layout: [] } })
    const versions = await payload.findVersions({ collection: 'products', where: { parent: { equals: legacy.id } }, depth: 0 })
    await payload.update({ collection: 'products', id: legacy.id, data: { layout: composed as never } })
    for (const options of [{}, { draft: true }, { draft: true, autosave: true }]) {
      for (const layout of [[], null, [{ blockType: 'cta' }]]) {
        await expect(payload.update({ collection: 'products', id: legacy.id, locale: 'en', ...options, data: { layout: layout as never } })).rejects.toMatchObject({ status: 400 })
      }
    }
    const bulk = await payload.update({ collection: 'products', where: { id: { equals: legacy.id } }, data: { layout: [] } })
    expect(bulk.docs).toHaveLength(0)
    expect(bulk.errors).toHaveLength(1)
    for (const draft of [false, true]) await expect(payload.restoreVersion({ collection: 'products', id: versions.docs[0].id, draft })).rejects.toMatchObject({ status: 400 })
  })

  it('rejects hidden required blocks, malformed/case variants and duplicate row ids even in drafts', async () => {
    for (const layout of [
      [{ blockType: 'productHero' }, { blockType: 'productEditions', appearance: { hidden: true } }],
      [{ blockType: 'productHero' }, { blockType: 'productEditions', appearance: { hidden: 'true' } }],
      [{ blockType: 'productHero', appearance: { hidden: 'true' } }, { blockType: 'productEditions' }],
      [{ blockType: 'ProductHero' }, { blockType: 'ProductEditions' }],
      [{ blockType: 'productHero', id: 'same' }, { blockType: 'productEditions', id: 'same' }],
      { en: composed },
    ]) await expect(payload.update({ collection: 'products', id, draft: true, autosave: true, data: { layout: layout as never } })).rejects.toMatchObject({ status: 400 })
  })

  it('allows partial block updates and duplication without weakening required blocks', async () => {
    const stored = await payload.findByID({ collection: 'products', id, draft: true, depth: 0 })
    const updated = await payload.update({ collection: 'products', id, draft: true, data: { layout: stored.layout!.map((b) => ({ id: b.id })) as never } })
    expect(updated.layout?.map((b) => b.blockType)).toEqual(stored.layout?.map((b) => b.blockType))
    const copy = await payload.create({ collection: 'products', duplicateFromID: id, data: { title: 'Copy', slug: 'copy', family: 1 } })
    expect(copy.layout?.filter((b) => b.blockType === 'productEditions')).toHaveLength(1)
    expect(copy.layout?.[0].blockType).toBe('productHero')
    expect(copy.layout?.[0].id).not.toBe(stored.layout?.[0].id)
  })

  it('rejects bypasses in installed REST and MCP update handlers', async () => {
    const { createLocalReq } = await import('payload')
    const admin = await payload.create({ collection: 'users', data: { email: 'v2-audit@example.test', password: 'V2-audit-test-123!', roles: ['admin'] } })
    const user = { ...admin, collection: 'users' as const }
    const { updateByIDHandler } = await import(resolve('node_modules/payload/dist/collections/endpoints/updateByID.js'))
    const req = await createLocalReq({ user }, payload)
    req.routeParams = { collection: 'products', id: String(id) }
    req.query = { draft: 'true', autosave: 'true', locale: 'en' }
    req.data = { layout: [] }
    await expect(updateByIDHandler(req)).rejects.toMatchObject({ status: 400 })
    const { updateResourceTool } = await import(resolve('node_modules/@payloadcms/plugin-mcp/dist/mcp/tools/resource/update.js'))
    let update: (params: unknown) => Promise<{ content: { text: string }[] }> = async () => { throw new Error('Tool not registered') }
    const server = { registerTool: (_name: string, _schema: unknown, callback: typeof update) => { update = callback } }
    updateResourceTool(server, await createLocalReq({ user }, payload), user, false, 'products', { products: { enabled: true } }, {
      type: 'object', properties: { layout: { type: 'array', items: { type: 'object' } } },
    })
    expect((await update({ id, layout: [], locale: 'en', draft: true })).content[0].text).toMatch(/Error updating resource/)
    const bulk = await update({ where: JSON.stringify({ id: { equals: id } }), layout: [], draft: true })
    expect(bulk.content[0].text).toMatch(/Updated: 0 documents/)
    expect(bulk.content[0].text).toMatch(/Errors: 1/)
  })

  it('imports compositions idempotently and keeps the composed layout when a legacy seed is re-imported', async () => {
    const { createLocalReq } = await import('payload')
    const { importContent } = await import('../../src/lib/content-import/importer')
    const { withImportTransaction } = await import('../../src/lib/content-import/transaction')
    const doc = { title: 'Import', slug: 'v2-import', family: 'aile', layout: [{ blockType: 'productHero' }, { blockType: 'productEditions' }] }
    const load = async (layout = doc.layout) => {
      const req = await createLocalReq({}, payload)
      return withImportTransaction(payload, req, () => importContent({ payload, req, root: process.cwd(), markdown: () => ({}), log: () => {},
        sources: [{ file: 'v2-import.json', seed: { version: 1, products: [{ tr: { ...doc, layout }, en: { ...doc, layout } }] } }],
      }))
    }
    await load()
    const read = async () => (await payload.find({ collection: 'products', where: { slug: { equals: doc.slug } }, locale: 'tr', depth: 0 })).docs[0]
    const first = await read()
    expect((await load()).creates).toBe(0)
    expect((await read()).layout).toEqual(first.layout)
    await expect(load([])).resolves.toMatchObject({ updates: 1 })
    await expect(load([{ blockType: 'hero', heading: 'Eski' } as never])).resolves.toMatchObject({ updates: 1 })
    expect((await read()).layout).toEqual(first.layout)
  })

  describe('legacy seed protection with real versions and transactions', () => {
    const legacy = [{ blockType: 'hero', heading: 'Seed hero' }]
    const record = (slug: string, layout: Data[] = legacy): RecordInput => ({
      tr: { title: 'Seed TR', slug, family: 'aile', layout },
      en: { title: 'Seed EN', slug, family: 'aile', layout },
    })
    const load = async (product: RecordInput, rollback = false) => {
      const { createLocalReq } = await import('payload')
      const { importContent } = await import('../../src/lib/content-import/importer')
      const { withImportTransaction } = await import('../../src/lib/content-import/transaction')
      const req = await createLocalReq({}, payload)
      const logs: string[] = []
      const result = await withImportTransaction(payload, req, () => importContent({
        payload, req, root: dir, rollbackRun: rollback, markdown: () => ({}), log: m => logs.push(m),
        sources: [{ file: 'audit.json', seed: { version: 1, products: [product] } }],
      }), { rollback })
      return { result, logs }
    }
    const read = (id: number, locale: 'tr' | 'en', draft = false) => payload.findByID({
      collection: 'products', id, locale, draft, fallbackLocale: false, depth: 0,
    })

    it.each([
      { locale: 'tr' as const, autosave: false },
      { locale: 'tr' as const, autosave: true },
      { locale: 'en' as const, autosave: true },
    ])('preserves a composition existing only in a $locale draft (autosave=$autosave), including rollback dry-run', async ({ locale, autosave }) => {
      const seed = record(`audit-draft-${locale}-${autosave}`)
      await load(seed)
      const id = (await payload.find({ collection: 'products', where: { slug: { equals: seed.tr.slug } }, locale: 'tr' })).docs[0].id
      await payload.update({ collection: 'products', id, locale, draft: true, autosave,
        data: { layout: composed as never, _status: 'draft' },
      })
      const snapshot = async () => ({
        published: await Promise.all((['tr', 'en'] as const).map(l => read(id, l))),
        draft: await Promise.all((['tr', 'en'] as const).map(l => read(id, l, true))),
        versions: (await run(`SELECT * FROM _products_v WHERE parent_id=${id} ORDER BY id`)).rows,
      })
      const before = await snapshot()
      expect(before.published[0].layout?.[0].blockType).toBe('hero')
      expect(before.draft[0].layout?.[0].blockType).toBe('productHero')
      seed.tr.title = 'Imported TR'
      seed.en.title = 'Imported EN'
      seed.tr.features = [{ title: 'Yeni özellik' }]
      seed.en.features = [{ title: 'New feature' }]
      seed.tr.systemRequirements = [{ os: 'web' }]
      seed.en.systemRequirements = [{ os: 'web' }]
      // The unused legacy layout may refer to content that no longer exists.
      seed.tr.layout = seed.en.layout = [{ blockType: 'faq', faqs: ['deleted-faq'] }]
      const dry = await load(seed, true)
      expect(dry.logs.filter(l => l.includes('layout korundu'))).toHaveLength(1)
      expect(await snapshot()).toEqual(before)
      const actual = await load(seed)
      expect(actual.result).toEqual(dry.result)
      expect(actual.logs.filter(l => l.includes('layout korundu'))).toHaveLength(1)
      for (const [i, l] of (['tr', 'en'] as const).entries()) {
        const doc = await read(id, l)
        expect(doc.layout).toEqual(before.draft[i].layout)
        expect(doc.title).toBe(seed[l].title)
        expect(doc.features?.[0].title).toBe((seed[l].features as Data[])[0].title)
        expect(doc.systemRequirements?.[0].os).toBe('web')
        expect(doc._status).toBe('published')
      }
      const after = await snapshot()
      await load(seed)
      expect(await snapshot()).toEqual(after)
    })

    it('sees a composition written earlier in the same uncommitted transaction', async () => {
      const { createLocalReq } = await import('payload')
      const { importContent } = await import('../../src/lib/content-import/importer')
      const { withImportTransaction } = await import('../../src/lib/content-import/transaction')
      const seed = record('audit-same-transaction')
      await load(seed)
      const id = (await payload.find({ collection: 'products', where: { slug: { equals: seed.tr.slug } }, locale: 'tr' })).docs[0].id
      const req = await createLocalReq({}, payload)
      await withImportTransaction(payload, req, async () => {
        const draft = await payload.update({ collection: 'products', id, req, draft: true, autosave: true,
          data: { layout: composed as never, _status: 'draft' },
        })
        const logs: string[] = []
        await importContent({ payload, req, root: dir, markdown: () => ({}), log: m => logs.push(m),
          sources: [{ file: 'transaction.json', seed: { version: 1, products: [seed] } }],
        })
        expect(logs.some(l => l.includes('layout korundu'))).toBe(true)
        expect((await payload.findByID({ collection: 'products', id, req, depth: 0 })).layout).toEqual(draft.layout)
      })
      expect((await read(id, 'tr')).layout?.[0].blockType).toBe('productHero')
    })

    it('keeps localized block text and settings while importing fields outside layout', async () => {
      const seed = record('audit-published-composition', [...composed.slice(0, 4), { blockType: 'cta', heading: 'Türkçe başlık' }])
      await load(seed)
      const id = (await payload.find({ collection: 'products', where: { slug: { equals: seed.tr.slug } }, locale: 'tr' })).docs[0].id
      const english = await read(id, 'en')
      const layout = english.layout!.map(b => b.blockType === 'cta' ? { ...b, heading: 'English heading' } : b)
      await payload.update({ collection: 'products', id, locale: 'en', data: { layout, _status: 'published' } })
      const before = await Promise.all((['tr', 'en'] as const).map(l => read(id, l)))
      expect(before[0].layout?.find(b => b.blockType === 'cta')?.heading).toBe('Türkçe başlık')
      expect(before[1].layout?.find(b => b.blockType === 'cta')?.heading).toBe('English heading')
      const legacySeed = record(String(seed.tr.slug))
      legacySeed.tr.summary = 'Yeni özet'
      legacySeed.en.summary = 'New summary'
      await load(legacySeed)
      for (const [i, locale] of (['tr', 'en'] as const).entries()) {
        const doc = await read(id, locale)
        expect(doc.layout).toEqual(before[i].layout)
        expect(doc.summary).toBe(legacySeed[locale].summary)
      }
    })

    it('writes a composed seed and still rejects missing required blocks in commit and rollback runs', async () => {
      const seed = record('audit-seed-composition', composed.slice(0, 4))
      await load(seed)
      const replacement = [{ blockType: 'productHero' }, { blockType: 'productEditions' }, { blockType: 'productDocs' }]
      await load(record(String(seed.tr.slug), replacement))
      const doc = (await payload.find({ collection: 'products', where: { slug: { equals: seed.tr.slug } }, locale: 'tr' })).docs[0]
      expect(doc.layout?.map(b => b.blockType)).toEqual(replacement.map(b => b.blockType))
      for (const rollback of [true, false]) {
        await expect(load(record(String(seed.tr.slug), [{ blockType: 'productHero' }]), rollback)).rejects.toMatchObject({ cause: { status: 400 } })
        expect((await read(doc.id, 'tr')).layout).toEqual(doc.layout)
      }
    })
  })
})
