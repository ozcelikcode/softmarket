import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { composeProductLayout, PRODUCT_BOUND_BLOCKS } from '../../src/lib/blocks/product-composition'
import { compatFilteredRows } from '../../src/editor/canvas/rules'
import { VERSION_CONFLICT_STATUS } from '../../src/editor/canvas/concurrency'

/*
 * V5 visual editor on real (temporary) SQLite. The editor only changes the Payload form; what reaches the
 * database is Payload's own autosave (or the editor's pagehide flush, the same request): the whole document's
 * values in ONE locale, `draft: true, autosave: true`. These tests replay exactly that on product + page records:
 * - no-op round trip: TR and EN read without fallback, saved back unchanged => identical documents (Lexical too),
 * - an EN inline edit changes only the EN value; TR stays, empty EN fields are not filled with TR fallback,
 * - block ids survive moves/duplicates in both locales; the V2 "Teklif İste" rule still rejects removal,
 * - materialising a compatibility product keeps the visible page (filtered duplicates become hidden rows),
 * - optimistic concurrency (P1): a save carrying a stale `editorVersion` gets 409 and changes nothing; of two
 *   concurrent saves from the same base exactly one wins; writes without a version (MCP/import) pass.
 */
let payload: Payload
let dir: string
let productId: number
let pageId: number

const lexical = (text: string) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, textStyle: '',
      children: [{ type: 'text', text, format: 1, detail: 0, mode: 'normal', style: '', version: 1 }] }],
  },
})
const VOLATILE = new Set(['updatedAt', 'createdAt', '_status', 'editorVersion'])
const strip = (doc: Record<string, unknown>) => Object.fromEntries(Object.entries(doc).filter(([k]) => !VOLATILE.has(k)))
const read = async (collection: 'products' | 'pages', id: number, locale: 'tr' | 'en') =>
  (await payload.findByID({ collection, id, locale, fallbackLocale: false, draft: true, depth: 0, overrideAccess: true })) as unknown as Record<string, unknown>
/** The editor's save: every value of the document in one locale, as an autosave draft. */
const autosave = (collection: 'products' | 'pages', id: number, locale: 'tr' | 'en', data: Record<string, unknown>) =>
  payload.update({ collection, id, locale, draft: true, autosave: true, overrideAccess: true, data: { ...strip(data), _status: 'draft' } as never })

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-v5-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await payload.db.drizzle.$client.execute('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: never[] }
  await payload.db.migrate({ migrations })

  const family = await payload.create({ collection: 'product-families', locale: 'tr', overrideAccess: true, data: { title: 'Aile', _status: 'published' } as never })
  await payload.update({ collection: 'product-families', id: family.id, locale: 'en', overrideAccess: true, data: { title: 'Family', _status: 'published' } as never })
  const layout = [
    ...PRODUCT_BOUND_BLOCKS.map((blockType) => ({ blockType })),
    { blockType: 'cta', heading: 'Teklif alın', body: 'Hemen', style: 'card' },
    { blockType: 'richText', content: lexical('Zengin metin') },
  ]
  const product = await payload.create({
    collection: 'products', locale: 'tr', overrideAccess: true,
    data: { title: 'Ürün', family: family.id, tagline: 'Slogan', summary: 'Özet', features: [{ title: 'Hızlı', description: 'Çok' }], _status: 'published', layout } as never,
  })
  productId = product.id
  const en = (await read('products', productId, 'tr')).layout as { id: string }[]
  // EN copy: same rows (ids), own texts; tagline/summary deliberately left empty in EN.
  await payload.update({ collection: 'products', id: productId, locale: 'en', overrideAccess: true, data: {
    title: 'Product', features: [{ ...((await read('products', productId, 'tr')).features as object[])[0], title: 'Fast', description: 'Very' }],
    layout: en.map((b) => ({ ...b, ...(('heading' in b) ? { heading: 'Get a quote', body: 'Now' } : {}), ...(('content' in b) ? { content: lexical('Rich text') } : {}) })),
    _status: 'published',
  } as never })

  const page = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: true, data: {
    title: 'Ana sayfa', slug: 'home', _status: 'published',
    layout: [{ blockType: 'hero', heading: 'Merhaba', subheading: 'Alt', actions: [] }, { blockType: 'richText', content: lexical('Sayfa metni') }, { blockType: 'cta', heading: 'Yazın' }],
  } as never })
  pageId = page.id
}, 180_000)
afterAll(async () => { await payload?.destroy(); if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('visual editor saves (temp SQLite)', () => {
  it.each([['products'], ['pages']] as const)('%s: no-op save in TR and EN changes nothing (Lexical JSON included)', async (collection) => {
    const id = collection === 'products' ? productId : pageId
    for (const locale of ['tr', 'en'] as const) {
      const before = await read(collection, id, locale)
      await autosave(collection, id, locale, before)
      const after = await read(collection, id, locale)
      expect(strip(after)).toEqual(strip(before))
    }
    const tr = await read(collection, id, 'tr')
    const rich = (tr.layout as { blockType: string; content?: unknown }[]).find((b) => b.blockType === 'richText')
    expect(rich?.content).toEqual(lexical(collection === 'products' ? 'Zengin metin' : 'Sayfa metni'))
  })

  it('an EN inline edit only changes EN; empty EN fields are not filled with the TR fallback', async () => {
    const trBefore = await read('products', productId, 'tr')
    const en = await read('products', productId, 'en')
    expect(en.tagline ?? null).toBeNull()
    const layout = (en.layout as Record<string, unknown>[]).map((b) => (b.blockType === 'cta' ? { ...b, heading: 'Request a quote' } : b))
    await autosave('products', productId, 'en', { ...en, title: 'Product Pro', layout })
    const enAfter = await read('products', productId, 'en')
    expect(enAfter.title).toBe('Product Pro')
    expect((enAfter.layout as { blockType: string; heading?: string }[]).find((b) => b.blockType === 'cta')?.heading).toBe('Request a quote')
    expect(enAfter.tagline ?? null).toBeNull()
    expect(enAfter.summary ?? null).toBeNull()
    expect(strip(await read('products', productId, 'tr'))).toEqual(strip(trBefore))
  })

  it('moves and duplicates keep row ids in both locales; the required editions block cannot be removed', async () => {
    const tr = await read('products', productId, 'tr')
    const rows = tr.layout as { id: string; blockType: string }[]
    const editions = rows.findIndex((b) => b.blockType === 'productEditions')
    const features = rows.findIndex((b) => b.blockType === 'productFeatures')
    const moved = [...rows]
    const [row] = moved.splice(editions, 1)
    moved.splice(features, 0, row!)
    const cta = moved.find((b) => b.blockType === 'cta')!
    moved.push({ ...cta, id: '6720f1c2a1b2c3d4e5f60799' })
    await autosave('products', productId, 'tr', { ...tr, layout: moved })
    const trAfter = (await read('products', productId, 'tr')).layout as { id: string; blockType: string; heading?: string }[]
    const enAfter = (await read('products', productId, 'en')).layout as { id: string; blockType: string; heading?: string }[]
    expect(trAfter.map((b) => b.id)).toEqual(moved.map((b) => b.id))
    expect(enAfter.map((b) => b.id)).toEqual(moved.map((b) => b.id))
    expect(enAfter.find((b) => b.blockType === 'cta')?.heading).toBe('Request a quote')
    const without = trAfter.filter((b) => b.blockType !== 'productEditions')
    await expect(autosave('products', productId, 'tr', { ...tr, layout: without })).rejects.toMatchObject({ status: 400 })
  })

  it('materialising a compatibility product keeps the visible page', async () => {
    const legacyLayout = [{ blockType: 'hero', heading: 'Eski giriş' }, { blockType: 'featureGrid', heading: 'Tekrar', items: [{ title: 'A' }] }, { blockType: 'cta', heading: 'Son' }]
    const legacy = await payload.create({ collection: 'products', locale: 'tr', overrideAccess: true, data: {
      title: 'Eski', family: (await read('products', productId, 'tr')).family, features: [{ title: 'Özellik' }], _status: 'published', layout: legacyLayout,
    } as never })
    const content = { summary: false, features: true, specs: false, requirements: false }
    const stored = (await read('products', legacy.id, 'tr')).layout as { id: string; blockType: string; appearance?: { hidden?: boolean } }[]
    const visibleBefore = composeProductLayout(stored, content).blocks.filter((b) => !b.appearance?.hidden).map((b) => b.blockType)
    // What the host does: 8 bound sections on top, the compat-filtered extras hidden.
    const hide = new Set(compatFilteredRows(stored, content))
    const materialised = [...PRODUCT_BOUND_BLOCKS.map((blockType) => ({ blockType })), ...stored.map((b, i) => (hide.has(i) ? { ...b, appearance: { ...b.appearance, hidden: true } } : b))]
    await autosave('products', legacy.id, 'tr', { ...(await read('products', legacy.id, 'tr')), layout: materialised })
    const after = (await read('products', legacy.id, 'tr')).layout as { blockType: string; appearance?: { hidden?: boolean } }[]
    const composed = composeProductLayout(after, content)
    expect(composed.mode).toBe('composition')
    expect(composed.blocks.filter((b) => !b.appearance?.hidden).map((b) => b.blockType)).toEqual(visibleBefore)
    expect(after.filter((b) => b.appearance?.hidden).map((b) => b.blockType)).toEqual(['hero', 'featureGrid'])
  })

  describe('optimistic concurrency (editorVersion)', () => {
    const save = (id: number, version: string | undefined, data: Record<string, unknown>, opts: { autosave?: boolean } = {}) =>
      payload.update({ collection: 'products', id, locale: 'tr', draft: true, autosave: opts.autosave ?? true, overrideAccess: true, data: { ...data, ...(version ? { editorVersion: version } : {}), _status: 'draft' } as never })

    it('reads expose a snapshot token; a save returns a token usable for the next save', async () => {
      const doc = await read('products', productId, 'tr')
      expect(doc.editorVersion).toMatch(/^[a-f0-9]{64}$/)
      const saved = (await save(productId, doc.editorVersion as string, { tagline: 'Sürüm 1' })) as unknown as Record<string, unknown>
      expect(saved.editorVersion).not.toBe(doc.editorVersion)
      expect((await read('products', productId, 'tr')).editorVersion).toBe(saved.editorVersion)
      // Chained saves from the returned version keep working (autosave, then a manual draft save).
      const next = (await save(productId, saved.editorVersion as string, { tagline: 'Sürüm 2' })) as unknown as Record<string, unknown>
      await save(productId, next.editorVersion as string, { tagline: 'Sürüm 3' }, { autosave: false })
      expect((await read('products', productId, 'tr')).tagline).toBe('Sürüm 3')
    })

    it('tokens cover both locales, independent of locale/fallback/depth; anonymous reads do not expose them', async () => {
      const tr = await read('products', productId, 'tr')
      const en = await read('products', productId, 'en')
      expect(en.editorVersion).toBe(tr.editorVersion)
      const populated = await payload.findByID({ collection: 'products', id: productId, draft: true, locale: 'en', depth: 2 })
      expect(populated.editorVersion).toBe(tr.editorVersion)
      await payload.update({ collection: 'products', id: productId, locale: 'en', draft: true, data: { title: 'Remote English' } })
      await expect(save(productId, tr.editorVersion as string, { title: 'Stale Turkish' })).rejects.toMatchObject({ status: 409 })
      const anon = await payload.findByID({ collection: 'products', id: productId, overrideAccess: false, user: null })
      expect(anon).not.toHaveProperty('editorVersion')
      for (const table of ['products', '_products_v', 'pages', '_pages_v']) {
        const columns = await payload.db.drizzle.$client.execute(`PRAGMA table_info(${table})`)
        expect(columns.rows.some((row) => /editor.?version/i.test(String(row.name)))).toBe(false)
      }
    })

    it('the installed REST handler returns a usable version for draft/publish; stale writes still get 409', async () => {
      const { createLocalReq } = await import('payload')
      const admin = await payload.create({ collection: 'users', data: { email: 'v5-audit@example.test', password: 'Audit-test-password-123!', roles: ['admin'] } })
      const { updateByIDHandler } = await import(resolve('node_modules/payload/dist/collections/endpoints/updateByID.js'))
      const update = async (data: Record<string, unknown>, draft: boolean) => {
        const req = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
        req.payloadAPI = 'REST'
        req.locale = 'en'
        req.fallbackLocale = null
        req.routeParams = { collection: 'pages', id: String(pageId) }
        req.query = { draft: String(draft), autosave: String(draft), locale: 'en', depth: '0' }
        req.data = data
        return (await (await updateByIDHandler(req)).json()).doc as { editorVersion: string }
      }
      const base = await read('pages', pageId, 'en')
      const saved = await update({ title: 'REST draft', layout: [], editorVersion: base.editorVersion }, true)
      expect(saved.editorVersion).toBe((await read('pages', pageId, 'en')).editorVersion)
      await expect(update({ title: 'REST stale', editorVersion: base.editorVersion }, false)).rejects.toMatchObject({ status: 409 })
      const published = await update({ title: 'REST published', _status: 'published', editorVersion: saved.editorVersion }, false)
      expect(published.editorVersion).toBe((await read('pages', pageId, 'en')).editorVersion)
    })

    it('rejects stale snapshots even when updatedAt repeats or the clock goes backwards', async () => {
      const time = Date.now()
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(time)
        await save(productId, undefined, { tagline: 'clock base' })
        const base = await read('products', productId, 'tr')
        await save(productId, base.editorVersion as string, { tagline: 'same millisecond' })
        const current = await read('products', productId, 'tr')
        expect(current.updatedAt).toBe(base.updatedAt)
        expect(current.editorVersion).not.toBe(base.editorVersion)
        await expect(save(productId, base.editorVersion as string, { tagline: 'lost update' })).rejects.toMatchObject({ status: 409 })
        vi.setSystemTime(time - 60_000)
        await save(productId, current.editorVersion as string, { tagline: 'clock moved back' })
        await expect(save(productId, current.editorVersion as string, { tagline: 'lost again' })).rejects.toMatchObject({ status: 409 })
      } finally { vi.useRealTimers() }
    })

    it('blank/null tokens cannot opt out; omitted versions, duplicate, bulk update and intentional restore retain their API contract', async () => {
      for (const editorVersion of ['', null]) {
        await expect(payload.update({ collection: 'pages', id: pageId, draft: true, data: { title: 'bad', editorVersion } })).rejects.toMatchObject({ status: 400 })
      }
      const copy = await payload.create({ collection: 'pages', duplicateFromID: pageId, data: { title: 'Duplicate', slug: 'duplicate-audit' } })
      expect(copy.id).not.toBe(pageId)
      const bulk = await payload.update({ collection: 'pages', where: { id: { equals: copy.id } }, data: { title: 'Bulk' }, draft: true })
      expect(bulk.errors).toEqual([])
      const versions = await payload.findVersions({ collection: 'pages', where: { parent: { equals: copy.id } }, sort: 'updatedAt', limit: 1 })
      const { createLocalReq } = await import('payload')
      const req = await createLocalReq({}, payload)
      const stale = await read('pages', copy.id, 'tr')
      await payload.restoreVersion({ collection: 'pages', id: versions.docs[0]!.id, draft: true, req })
      await expect(payload.update({ collection: 'pages', id: copy.id, draft: true, req, data: { title: 'stale after restore', editorVersion: stale.editorVersion } as never }))
        .rejects.toMatchObject({ status: 409 })
      const latest = await read('pages', copy.id, 'tr')
      await payload.update({ collection: 'pages', id: copy.id, draft: false, locale: 'en', data: { title: 'Publish English', layout: [], _status: 'published', editorVersion: latest.editorVersion } as never })
    })

    it('merged layouts are still checked by the server V2 constraints', async () => {
      const doc = await read('products', productId, 'tr')
      const rows = doc.layout as { blockType: string }[]
      await expect(save(productId, doc.editorVersion as string, { layout: rows.filter((row) => row.blockType !== 'productEditions') })).rejects.toMatchObject({ status: 400 })
      const saved = await save(productId, doc.editorVersion as string, { layout: [...rows.slice(1), rows[0]] })
      // The existing V2 contract normalises a misplaced hero to the first position.
      expect(saved.layout?.[0]?.blockType).toBe('productHero')
    })

    it('nested Local API calls share req; outside reads bypass the writer queue; mixed concurrent load drains without leaked sessions', async () => {
      const transactionID = await payload.db.beginTransaction()
      const req = { transactionID } as Partial<PayloadRequest>
      try {
        await payload.update({ collection: 'pages', id: pageId, draft: true, req, data: { title: 'In outer transaction' } })
        const readStart = performance.now()
        await payload.find({ collection: 'pages', overrideAccess: false, user: null, depth: 0 })
        expect(performance.now() - readStart).toBeLessThan(2000)
      } finally { await payload.db.rollbackTransaction(transactionID!) }
      const started = performance.now()
      const reads: number[] = []
      const results = await Promise.allSettled([
        ...Array.from({ length: 30 }, (_, i) => payload.update({ collection: 'pages', id: pageId, draft: true, data: { title: `Load ${i}` } })),
        ...Array.from({ length: 30 }, async () => {
          const start = performance.now()
          await payload.find({ collection: 'pages', overrideAccess: false, user: null, depth: 0 })
          reads.push(performance.now() - start)
        }),
      ])
      const errors = results.filter((result) => result.status === 'rejected')
      console.info('V5 concurrency load', JSON.stringify({ writes: 30, reads: 30, errors: errors.length, durationMs: Math.round(performance.now() - started), maxReadMs: Math.round(Math.max(...reads)) }))
      expect(errors).toEqual([])
      expect(Object.keys(payload.db.sessions ?? {})).toHaveLength(0)
      expect((await read('pages', pageId, 'tr')).title).toBe('Load 29')
    }, 20_000)

    it('a stale version is rejected with 409 and nothing changes; writes without a version (MCP/import) pass', async () => {
      const base = (await read('products', productId, 'tr')).editorVersion as string
      await save(productId, undefined, { tagline: 'MCP yazımı' }) // e.g. MCP updateProducts / content:import
      const before = await read('products', productId, 'tr')
      await expect(save(productId, base, { tagline: 'Eski editör' })).rejects.toMatchObject({ status: VERSION_CONFLICT_STATUS })
      expect(strip(await read('products', productId, 'tr'))).toEqual(strip(before))
      expect((await read('products', productId, 'tr')).tagline).toBe('MCP yazımı')
      await expect(save(productId, 'not-a-date', { tagline: 'x' })).rejects.toMatchObject({ status: 400 })
      await expect(save(productId, before.updatedAt as string, { tagline: 'old editor open across deployment' })).rejects.toMatchObject({ status: 409 })
    })

    it('plain concurrent writes (no version) are serialised: both land, later writes stay visible', async () => {
      await Promise.all(['A', 'B', 'C'].map((x) => payload.update({ collection: 'products', id: productId, locale: 'tr', draft: true, overrideAccess: true, data: { summary: `Eşzamanlı ${x}` } as never })))
      expect(String((await read('products', productId, 'tr')).summary)).toMatch(/^Eşzamanlı [ABC]$/)
      await payload.update({ collection: 'products', id: productId, locale: 'tr', draft: true, overrideAccess: true, data: { summary: 'Sonra' } as never })
      expect((await read('products', productId, 'tr')).summary).toBe('Sonra')
    })

    it('pages are guarded too', async () => {
      const base = (await read('pages', pageId, 'tr')).editorVersion as string
      await payload.update({ collection: 'pages', id: pageId, locale: 'tr', draft: true, overrideAccess: true, data: { title: 'Dışarıdan' } as never })
      await expect(payload.update({ collection: 'pages', id: pageId, locale: 'tr', draft: true, autosave: true, overrideAccess: true, data: { title: 'Editör', editorVersion: base } as never }))
        .rejects.toMatchObject({ status: VERSION_CONFLICT_STATUS })
      expect((await read('pages', pageId, 'tr')).title).toBe('Dışarıdan')
    })
    it('two concurrent saves from the same base: exactly one wins, the other gets 409, no data is lost', async () => {
      const base = (await read('products', productId, 'tr')).editorVersion as string
      const results = await Promise.allSettled([
        save(productId, base, { tagline: 'Sekme A' }),
        save(productId, base, { tagline: 'Sekme B' }),
      ])
      const won = results.filter((r) => r.status === 'fulfilled') as unknown as PromiseFulfilledResult<Record<string, unknown>>[]
      const lost = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      expect(won).toHaveLength(1)
      expect(lost).toHaveLength(1)
      // Transactions are queued (db-serial-transactions): the second re-reads the version after the first commit.
      expect(lost[0]!.reason).toMatchObject({ status: VERSION_CONFLICT_STATUS })
      const stored = await read('products', productId, 'tr')
      expect(stored.tagline).toBe(won[0]!.value.tagline)
      expect(stored.editorVersion).toBe(won[0]!.value.editorVersion)
      // The editor that lost reloads (fresh version) and saves again: accepted and visible.
      const again = await save(productId, stored.editorVersion as string, { tagline: 'Yeniden yüklendi' }) as unknown as Record<string, unknown>
      const after = await read('products', productId, 'tr')
      expect(after.tagline).toBe('Yeniden yüklendi')
      expect(after.editorVersion).toBe(again.editorVersion)
    })

  })
})

