import { describe, expect, it } from 'vitest'

import { Products } from '@/collections/Products'
import { productBlocks, productBoundBlocks, layoutBlocks, pageBlocks } from '@/blocks'
import { HERO_PRESETS, LCP_BLOCK_TYPES } from '@/fields/block-motion'
import { RESERVED_ANCHORS } from '@/fields/block-settings'
import {
  PRODUCT_BOUND_BLOCKS,
  PRODUCT_SECTION_IDS,
  composeProductLayout,
  productLayoutIssues,
  normalizeProductLayout,
  validateProductLayout,
  virtualBlock,
} from '@/lib/blocks/product-composition'
import { planBlocks } from '@/lib/blocks/render-plan'
import { seedSchema } from '@/lib/content-import/schema'

/*
 * V2 product page composition (plan-visual-editor §V2): compatibility mode (empty/legacy layout = pre-V2 page),
 * composition mode (layout order), the required "Teklif İste" (productEditions) block, hero first + single h1,
 * nav derivation, schema/config wiring.
 */

const all = { summary: true, features: true, specs: true, requirements: true }
const types = (blocks: { blockType: string }[]) => blocks.map((b) => b.blockType)
const b = (blockType: string, extra: Record<string, unknown> = {}) => ({ blockType, id: `${blockType}-1`, ...extra })
const field = (name: string) => {
  const tabs = Products.fields.find((f) => f.type === 'tabs') as { tabs: { fields: { name?: string }[] }[] }
  return tabs.tabs.flatMap((t) => t.fields).find((f) => f.name === name) as Record<string, unknown>
}

describe('compatibility mode (no bound block in layout)', () => {
  it('renders the pre-V2 fixed order followed by the extra blocks, with the old duplicate filter', () => {
    const layout = [b('hero'), b('featureGrid'), b('specTable'), b('faq'), b('cta')]
    const out = composeProductLayout(layout, all)
    expect(out.mode).toBe('compat')
    expect(types(out.blocks)).toEqual([...PRODUCT_BOUND_BLOCKS, 'faq', 'cta'])
    // Without product features/specs the CMS feature grid/spec table are kept (pre-V2 rule).
    const none = composeProductLayout(layout, { summary: false, features: false, specs: false, requirements: false })
    expect(types(none.blocks).slice(PRODUCT_BOUND_BLOCKS.length)).toEqual(['featureGrid', 'specTable', 'faq', 'cta'])
  })

  it('empty/null layout = default page; virtual blocks have stable ids and are never stored', () => {
    for (const layout of [null, undefined, []]) {
      const out = composeProductLayout(layout, all)
      expect(types(out.blocks)).toEqual([...PRODUCT_BOUND_BLOCKS])
      expect(out.blocks.map((x) => x.id)).toEqual(PRODUCT_BOUND_BLOCKS.map((t) => `virtual:${t}`))
    }
  })

  it('nav sections follow the pre-V2 rules (overview/features/specs only with content)', () => {
    expect(composeProductLayout([], all).sections).toEqual(['genel-bakis', 'ozellikler', 'teknik-ozellikler', 'surumler', 'indirmeler', 'dokumantasyon'])
    expect(composeProductLayout([], { summary: false, features: false, specs: false, requirements: true }).sections)
      .toEqual(['teknik-ozellikler', 'surumler', 'indirmeler', 'dokumantasyon'])
    expect(composeProductLayout([], { summary: false, features: false, specs: false, requirements: false }).sections)
      .toEqual(['surumler', 'indirmeler', 'dokumantasyon'])
  })

  it('virtual sections keep the pre-V2 markup: only hero entrance and feature cards animate', () => {
    const plan = planBlocks(composeProductLayout([], all).blocks)
    const motion = Object.fromEntries(plan.map((p) => [p.block.blockType, p.ctx.motion.preset]))
    expect(motion).toEqual({
      productHero: 'subtle', productNav: 'none', productOverview: 'none', productFeatures: 'subtle',
      productSpecs: 'none', productEditions: 'none', productDownloads: 'none', productDocs: 'none',
    })
    expect(plan[0].ctx.motion.safe).toBe(false) // legacy auto+scroll is unchanged by LCP protection
  })
})

describe('composition mode (at least one bound block)', () => {
  it('renders the stored order; removed optional sections are not rendered; no duplicate filter', () => {
    const layout = [b('productHero'), b('hero'), b('productEditions'), b('productFeatures'), b('featureGrid'), b('faq')]
    const out = composeProductLayout(layout, all)
    expect(out.mode).toBe('composition')
    expect(types(out.blocks)).toEqual(['productHero', 'hero', 'productEditions', 'productFeatures', 'featureGrid', 'faq'])
    expect(out.sections).toEqual(['surumler', 'ozellikler'])
  })

  it('guarantees the required editions/quote block and the hero on top for data that bypassed validation', () => {
    const out = composeProductLayout([b('faq'), b('productFeatures'), b('cta')], all)
    expect(types(out.blocks)).toEqual(['productHero', 'faq', 'productFeatures', 'productEditions', 'cta'])
    expect(out.blocks[0].id).toBe('virtual:productHero')
    expect(out.sections).toEqual(['ozellikler', 'surumler'])
    // Hero stored below other blocks -> moved to the top; duplicates -> first wins.
    const moved = composeProductLayout([b('productFeatures'), b('productHero'), b('productEditions'), b('productEditions', { id: 'dup' })], all)
    expect(types(moved.blocks)).toEqual(['productHero', 'productFeatures', 'productEditions'])
  })

  it('never hides the editions/quote block or the hero; optional sections can be hidden', () => {
    const out = composeProductLayout([
      b('productHero', { appearance: { hidden: true } }),
      b('productEditions', { appearance: { hidden: true } }),
      b('productDownloads', { appearance: { hidden: true } }),
      b('productNav', { appearance: { hidden: true } }),
    ], all)
    const plan = planBlocks(out.blocks)
    expect(types(plan.map((p) => p.block))).toEqual(['productHero', 'productEditions'])
    expect(out.sections).toEqual(['surumler'])
  })

  it('motion: product hero is LCP-protected wherever it is; sections take their preset', () => {
    const out = composeProductLayout([
      b('productHero', { motion: { preset: 'slide-left', trigger: 'load' } }),
      b('productEditions', { motion: { preset: 'slide-left' } }),
      b('productFeatures', { motion: { preset: 'zoom-in' } }),
    ], all)
    const plan = planBlocks(out.blocks)
    expect(plan[0].ctx.motion).toMatchObject({ preset: 'slide-left', safe: true })
    expect(plan[1].ctx.motion).toMatchObject({ preset: 'slide-left', safe: false })
    expect(plan[2].ctx.motion).toMatchObject({ preset: 'zoom-in', safe: false })
    // A hiding preset stored on the hero (bypassed validation) is downgraded to translate-only.
    expect(planBlocks([b('productHero', { motion: { preset: 'fade' } })])[0].ctx.motion).toMatchObject({ preset: 'slide-up', safe: true })
    // Layout hero blocks stay h2: the product hero owns the single h1.
    expect(planBlocks(composeProductLayout([b('productHero'), b('hero', { heading: 'X' }), b('productEditions')], all).blocks).map((p) => p.ctx.headingAs))
      .toEqual(['h2', 'h2', 'h2'])
  })

  it('specs without requirements: showRequirements=false drops the section when the product has no specs', () => {
    const content = { summary: false, features: false, specs: false, requirements: true }
    expect(composeProductLayout([b('productSpecs'), b('productEditions')], content).sections).toEqual(['teknik-ozellikler', 'surumler'])
    expect(composeProductLayout([b('productSpecs', { showRequirements: false }), b('productEditions')], content).sections).toEqual(['surumler'])
  })
})

describe('write rules (validator + hook on products.layout)', () => {
  it('accepts compatibility layouts and a complete composition', () => {
    expect(productLayoutIssues(null)).toEqual([])
    expect(productLayoutIssues([b('faq'), b('hero')])).toEqual([])
    expect(validateProductLayout([b('productHero'), b('faq'), b('productEditions')])).toBe(true)
    expect(validateProductLayout([b('productDownloads'), b('productEditions')])).toBe(true) // hero optional (rendered anyway)
  })

  it('moves a single hero to the front and leaves other orders and duplicates alone', () => {
    const hero = b('productHero', { id: 'h' })
    const rest = [b('faq', { id: 'f' }), b('productEditions', { id: 'e' })]
    expect(normalizeProductLayout([...rest, hero]).map((x) => x.id)).toEqual(['h', 'f', 'e'])
    expect(normalizeProductLayout([hero, ...rest])).toEqual([hero, ...rest])
    expect(normalizeProductLayout(rest)).toEqual(rest)
    const second = b('productHero', { id: 'h2' })
    expect(normalizeProductLayout([...rest, hero, second]).map((x) => x.id)).toEqual(['f', 'e', 'h', 'h2'])
    // Partial ID update (no blockType) resolves the type from the previous layout.
    expect(normalizeProductLayout([{ id: 'f' }, { id: 'h' }], [hero, ...rest]) as unknown[]).toEqual([{ id: 'h' }, { id: 'f' }])
  })

  it('rejects a composition without the editions/quote block, a hidden one and duplicates', () => {
    expect(productLayoutIssues([b('productHero'), b('productDownloads')])).toEqual([{ code: 'requiredMissing', blockType: 'productEditions' }])
    expect(productLayoutIssues([b('productEditions', { appearance: { hidden: true } })])).toEqual([{ code: 'hidden', blockType: 'productEditions' }])
    expect(productLayoutIssues([b('productEditions'), b('productEditions', { id: 'second' })])).toEqual([{ code: 'duplicate', blockType: 'productEditions' }])
    expect(productLayoutIssues([b('faq'), b('productHero'), b('productEditions')])).toEqual([]) // hero below blocks is normalized, not an error
    expect(productLayoutIssues([b('productHero'), b('productHero', { id: 'second' }), b('productEditions')])).toEqual([{ code: 'duplicate', blockType: 'productHero' }])
    expect(validateProductLayout([b('productNav')])).toMatch(/Sürümler ve Teklif İste.*zorunludur/)
    expect(validateProductLayout([b('productNav')], 'en')).toMatch(/Editions and Request a quote.*required/)
  })

  it('preserves legacy writes but cannot clear a previously composed layout', () => {
    const previous = [b('productHero'), b('productEditions')]
    for (const layout of [[], null, undefined, [b('cta')]]) {
      expect(productLayoutIssues(layout)).toEqual([])
      expect(productLayoutIssues(layout, previous)).toContainEqual({ code: 'requiredMissing', blockType: 'productEditions' })
    }
    expect(productLayoutIssues(previous.map(({ id }) => ({ id })), previous)).toEqual([])
    expect(productLayoutIssues([b('productHero'), b('productEditions', { id: 'productHero-1' })])).toContainEqual({ code: 'duplicateID' })
    for (const blockType of ['productHero', 'productEditions']) {
      expect(productLayoutIssues(previous.map((block) => block.blockType === blockType ? { ...block, appearance: { hidden: 'true' } } : block)))
        .toContainEqual({ code: 'hidden', blockType })
    }
  })
})

describe('config wiring', () => {
  it('bound blocks exist only on products; pages and other collections keep their block sets', () => {
    expect(productBoundBlocks.map((x) => x.slug)).toEqual([...PRODUCT_BOUND_BLOCKS])
    expect(productBlocks.map((x) => x.slug)).toEqual([...layoutBlocks.map((x) => x.slug), ...PRODUCT_BOUND_BLOCKS])
    for (const set of [layoutBlocks, pageBlocks]) for (const t of PRODUCT_BOUND_BLOCKS) expect(set.map((x) => x.slug)).not.toContain(t)
    const layout = field('layout') as { blocks: { slug: string }[]; validate?: unknown; hooks?: { beforeChange?: unknown[] } }
    expect(layout.blocks.map((x) => x.slug)).toEqual(productBlocks.map((x) => x.slug))
    expect(typeof layout.validate).toBe('function')
    expect(layout.hooks?.beforeChange).toHaveLength(1)
  })

  it('products autosave every 2 s (Live Preview) with drafts', () => {
    expect(Products.versions).toMatchObject({ maxPerDoc: 50, drafts: { autosave: { interval: 2000 } } })
  })

  it('required/hero blocks have no hide option; bound blocks have no anchor (fixed section ids)', () => {
    const appearanceKeys = (slug: string) => {
      const block = productBoundBlocks.find((x) => x.slug === slug)!
      const collapsible = block.fields.find((f) => f.type === 'collapsible' && (f as { fields: { name?: string }[] }).fields[0]?.name === 'appearance') as { fields: { fields: { type: string; fields?: { name?: string }[] }[] }[] }
      return collapsible.fields[0].fields.flatMap((row) => row.fields ?? []).map((f) => f.name)
    }
    expect(appearanceKeys('productEditions')).not.toContain('hidden')
    expect(appearanceKeys('productHero')).not.toContain('hidden')
    expect(appearanceKeys('productDownloads')).toContain('hidden')
    for (const t of PRODUCT_BOUND_BLOCKS) expect(appearanceKeys(t)).not.toContain('anchor')
    for (const id of Object.values(PRODUCT_SECTION_IDS)) expect(RESERVED_ANCHORS).toContain(id)
  })

  it('product hero only offers LCP-safe presets (config + seed schema)', () => {
    expect(LCP_BLOCK_TYPES).toContain('productHero')
    const defs = seedSchema.$defs as Record<string, { properties: Record<string, { properties?: Record<string, unknown> }> }>
    expect(defs.productHero.properties.motion.properties?.preset).toEqual({ enum: [...HERO_PRESETS] })
    expect(defs.productEditions.properties.blockType).toEqual({ const: 'productEditions' })
    expect(virtualBlock('productEditions')).toEqual({ blockType: 'productEditions', id: 'virtual:productEditions', appearance: { animation: 'none' } })
  })
})
