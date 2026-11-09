import { mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { composeProductLayout, PRODUCT_BOUND_BLOCKS } from '../../src/lib/blocks/product-composition'
import { compatFilteredRows } from '../../src/editor/canvas/rules'

/*
 * V5 visual editor on real (temporary) SQLite. The editor only changes the Payload form; what reaches the
 * database is Payload's own autosave (or the editor's pagehide flush, the same request): the whole document's
 * values in ONE locale, `draft: true, autosave: true`. These tests replay exactly that on product + page records:
 * - no-op round trip: TR and EN read without fallback, saved back unchanged => identical documents (Lexical too),
 * - an EN inline edit changes only the EN value; TR stays, empty EN fields are not filled with TR fallback,
 * - block ids survive moves/duplicates in both locales; the V2 "Teklif İste" rule still rejects removal,
 * - materialising a compatibility product keeps the visible page (filtered duplicates become hidden rows).
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
const VOLATILE = new Set(['updatedAt', 'createdAt', '_status'])
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
})
