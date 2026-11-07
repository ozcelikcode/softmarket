import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Field } from 'payload'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', async (importOriginal) => ({ ...(await importOriginal<typeof import('payload')>()), getPayload: vi.fn() }))

import { layoutBlocks } from '@/blocks'
import { blockRegistry } from '@/components/blocks/registry'
import { BLOCK_DEFAULTS, resolveAppearance } from '@/fields/block-settings'
import { clampLimit, gridClass, idsOf, normalizeLayout, normalizeSort, orderByIds, resolveViewAll } from '@/lib/blocks/lists'
import { caseStudySpec, familiesSpec, logosSpec, postsSpec, productsSpec, solutionsSpec } from '@/lib/blocks/data'

const NEW = ['productFamilies', 'productShowcase', 'solutionsGrid', 'caseStudy', 'newsList'] as const
const find = (fields: Field[], name: string): Field | undefined =>
  fields.flatMap((f) => ('fields' in f && !('name' in f && f.type === 'group') ? [f, ...find2(f.fields)] : [f])).find((f) => 'name' in f && f.name === name)
const find2 = (fields: Field[]): Field[] => fields.flatMap((f) => ('fields' in f ? [f, ...find2(f.fields)] : [f]))
const options = (block: string, field: string) =>
  ((find(layoutBlocks.find((b) => b.slug === block)!.fields, field) as { options: { value: string }[] }).options).map((o) => o.value)

describe('F5 block registration', () => {
  it('has defaults, renderer, TR/EN labels, group, preview image and settings for every new block', () => {
    for (const slug of NEW) {
      const block = layoutBlocks.find((b) => b.slug === slug)!
      expect(block, slug).toBeTruthy()
      expect(BLOCK_DEFAULTS[slug], slug).toBeTruthy()
      expect(blockRegistry[slug], slug).toBeTypeOf('function')
      expect(block.labels?.singular).toMatchObject({ tr: expect.any(String), en: expect.any(String) })
      expect(block.admin?.group).toBeTruthy()
      expect(block.imageURL).toBe(`/admin/blocks/${slug}.webp`)
      expect(existsSync(join(process.cwd(), 'public/admin/blocks', `${slug}.webp`)), slug).toBe(true)
      expect(find(block.fields, 'appearance'), slug).toBeTruthy()
    }
  })
  it('new blocks are appended: existing block order and slugs are untouched', () => {
    const slugs = layoutBlocks.map((b) => b.slug)
    expect(slugs.slice(0, 15)).toEqual(['hero', 'featureGrid', 'mediaText', 'specTable', 'stats', 'logoWall', 'cta', 'faq', 'richText', 'videoEmbed', 'media', 'testimonial', 'tabs', 'spacer', 'divider'])
    expect(slugs.slice(15)).toEqual([...NEW])
  })
  it('animation enum names fit the 63-character limit even in case-study version tables', () => {
    for (const slug of NEW) {
      const field = find2(layoutBlocks.find((b) => b.slug === slug)!.fields).find((f) => 'name' in f && f.name === 'animation') as { enumName?: (args: { tableName: string }) => string }
      const tableName = `_case_studies_v_blocks_${slug.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`
      const name = field.enumName?.({ tableName }) ?? `enum_${tableName}_appearance_animation`
      expect(name.length, name).toBeLessThanOrEqual(63)
    }
  })
  it('manual relationships are never populated by page queries (maxDepth 0) and appearance resolves', () => {
    for (const [slug, name] of [['productFamilies', 'families'], ['productShowcase', 'products'], ['productShowcase', 'family'], ['productShowcase', 'industry'], ['solutionsGrid', 'solutions'], ['solutionsGrid', 'industry'], ['caseStudy', 'caseStudy'], ['caseStudy', 'industry'], ['newsList', 'posts']] as const) {
      expect((find(layoutBlocks.find((b) => b.slug === slug)!.fields, name) as { maxDepth?: number }).maxDepth, `${slug}.${name}`).toBe(0)
    }
    expect(resolveAppearance({ blockType: 'solutionsGrid' }).theme).toBe('dark')
    expect(resolveAppearance({ blockType: 'newsList' }).theme).toBe('light')
  })
  it('list blocks expose source, limit, sort, layout and a view-all link', () => {
    for (const slug of ['productFamilies', 'productShowcase', 'solutionsGrid', 'newsList']) {
      const fields = layoutBlocks.find((b) => b.slug === slug)!.fields
      for (const name of ['eyebrow', 'heading', 'description', 'source', 'limit', 'sort', 'layout', 'showViewAll', 'viewAllLabel', 'viewAllUrl']) expect(find(fields, name), `${slug}.${name}`).toBeTruthy()
    }
    expect(options('productFamilies', 'layout')).toEqual(['grid-3', 'grid-2', 'grid-4', 'list'])
    expect(options('productShowcase', 'layout')).toEqual(['grid-3', 'grid-2', 'grid-4', 'list', 'alternating'])
    expect(options('productShowcase', 'source')).toEqual(['featured', 'all', 'manual', 'byFamily', 'byIndustry'])
    expect(options('newsList', 'sort')).toEqual(['order', 'newest', 'oldest', 'manual'])
  })
  it('logoWall keeps its stored values and only adds automatic sources + limit', () => {
    expect(options('logoWall', 'source')).toEqual(['manual', 'caseStudies', 'partners', 'allPartners', 'allCaseStudies', 'partnersAndCaseStudies'])
    const source = find(layoutBlocks.find((b) => b.slug === 'logoWall')!.fields, 'source') as { defaultValue: string }
    expect(source.defaultValue).toBe('manual')
  })
})

describe('list helpers', () => {
  it('normalizes limits, sorts, layouts and IDs defensively', () => {
    expect(clampLimit(undefined, 6)).toBe(6)
    expect(clampLimit(0, 6)).toBe(1)
    expect(clampLimit(999, 6)).toBe(24)
    expect(clampLimit(3.9, 6)).toBe(3)
    expect(clampLimit(NaN, 6)).toBe(6)
    expect(clampLimit(Infinity, 6)).toBe(6)
    expect(normalizeSort('bogus', 'newest')).toBe('newest')
    expect(normalizeSort('manual', 'order')).toBe('manual')
    expect(normalizeLayout('grid-9')).toBe('grid-3')
    expect(gridClass('list')).not.toContain('grid-cols')
    expect(idsOf([3, { id: 4 }, 3, '5', null, -1, 1.5])).toEqual([3, 4])
    expect(orderByIds([{ id: 1 }, { id: 2 }, { id: 3 }], [3, 1])).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }])
  })
  it('view-all: default, custom, off, and unsafe URLs fall back to the default', () => {
    expect(resolveViewAll({}, '/urunler', 'Hepsi')).toEqual({ href: '/urunler', label: 'Hepsi' })
    expect(resolveViewAll({ viewAllUrl: '/cozumler', viewAllLabel: ' Özel ' }, '/urunler', 'Hepsi')).toEqual({ href: '/cozumler', label: 'Özel' })
    expect(resolveViewAll({ showViewAll: false }, '/urunler', 'Hepsi')).toBeNull()
    expect(resolveViewAll({ viewAllUrl: 'javascript:alert(1)' }, '/urunler', 'Hepsi')?.href).toBe('/urunler')
    expect(resolveViewAll({ viewAllUrl: '//evil.example' }, '/urunler', 'Hepsi')?.href).toBe('/urunler')
    expect(resolveViewAll({ viewAllUrl: 'mailto:a@b.co' }, '/urunler', 'Hepsi')?.href).toBe('/urunler')
    for (const url of ['data:text/html,<script>alert(1)</script>', '/\\evil.example', 'https:\n//evil.example', '//evil.example']) {
      expect(resolveViewAll({ viewAllUrl: url }, '/urunler', 'Hepsi')?.href, url).toBe('/urunler')
    }
  })
  it('specs reduce blocks to stable primitive cache keys (same config -> same key)', () => {
    expect(familiesSpec({ source: 'manual', families: [{ id: 2 }, 1], limit: 50 })).toEqual({ source: 'manual', ids: [2, 1], ref: null, category: null, limit: 24, sort: 'order' })
    expect(productsSpec({ source: 'bogus' }).source).toBe('featured')
    expect(productsSpec({ source: 'byFamily', family: { id: 9 } }).ref).toBe(9)
    expect(productsSpec({ source: 'featured', family: 9 }).ref).toBeNull()
    expect(solutionsSpec({ source: 'byIndustry', industry: 4 }).ref).toBe(4)
    expect(postsSpec({ source: 'category', category: 'blog' })).toMatchObject({ category: 'blog', sort: 'newest', limit: 3 })
    expect(caseStudySpec({ source: 'manual', caseStudy: 7 })).toMatchObject({ ids: [7], limit: 1 })
    expect(logosSpec({ source: 'manual' })).toBeNull()
    expect(logosSpec({ source: 'allPartners', limit: 5 })).toMatchObject({ limit: 5 })
    expect(JSON.stringify(productsSpec({ source: 'all' }))).toBe(JSON.stringify(productsSpec({ source: 'all' })))
  })
})

describe('migration 20261107_130000_blocks_dynamic_set', () => {
  const source = readFileSync(join(process.cwd(), 'src/migrations/20261107_130000_blocks_dynamic_set.ts'), 'utf8')
  const up = source.slice(0, source.indexOf('export async function down'))
  const down = source.slice(source.indexOf('export async function down'))
  it('up only creates tables/indexes and adds the logo wall limit column', () => {
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|INSERT INTO|UPDATE `|RENAME/)
    expect([...up.matchAll(/ALTER TABLE `([a-z_]+)` ADD `([a-z_]+)`/g)].every((m) => m[1].endsWith('_blocks_logo_wall') && m[2] === 'limit')).toBe(true)
  })
  it('down never rebuilds tables: it drops only tables created by up and the new column', () => {
    expect(down).not.toMatch(/__new_|INSERT INTO|DELETE FROM|RENAME/)
    const created = new Set([...up.matchAll(/CREATE TABLE `([a-z_0-9]+)`/g)].map((m) => m[1]))
    const dropped = [...down.matchAll(/DROP TABLE `([a-z_0-9]+)`/g)].map((m) => m[1])
    expect(dropped.length).toBe(created.size)
    expect(dropped.every((t) => created.has(t))).toBe(true)
    expect([...down.matchAll(/ALTER TABLE `([a-z_]+)` DROP COLUMN `([a-z_]+)`/g)].every((m) => m[1].endsWith('_blocks_logo_wall') && m[2] === 'limit')).toBe(true)
  })
})
