/**
 * V2 product page composition (plan-visual-editor §V2). Pure module (no React/Payload runtime): shared by the
 * product page renderer, the `products.layout` validator/hook and tests.
 *
 * Product-bound blocks carry no content; they read the product (title, tagline, summary, heroImage, features,
 * specs, systemRequirements, brochure) and its editions/downloads/docs at render time.
 *
 * - Compatibility mode (no bound block in `layout`): the pre-V2 page in its fixed order, followed by the extra
 *   layout blocks with the old duplicate filter (hero, featureGrid/specTable when the product has that data).
 *   Virtual blocks have stable `virtual:<type>` ids and are never written to the database; they render without
 *   motion attributes, so the HTML equals the pre-V2 page.
 * - Composition mode (at least one bound block): `layout` order is rendered as stored, no filter. A bound
 *   section missing from the list is not rendered (the editor removed it), except the two guarantees below.
 *
 * Guarantees (user decision 2026-11-08, "Teklif İste zorunlu"):
 * - `productEditions` (editions + "Teklif İste" links) is required: movable, never removable/hideable.
 *   Writes are rejected by `validateProductLayout` (all write paths incl. drafts, see Products.ts); the
 *   renderer still re-inserts/unhides it for any stored data that bypassed validation.
 * - `productHero` owns the page h1, breadcrumb and LCP: it is always the first block and cannot be hidden.
 *   Missing -> the default hero is rendered on top (plan §V2-R, sales flow kept).
 */

export const PRODUCT_BOUND_BLOCKS = [
  'productHero',
  'productNav',
  'productOverview',
  'productFeatures',
  'productSpecs',
  'productEditions',
  'productDownloads',
  'productDocs',
] as const
export type ProductBoundType = (typeof PRODUCT_BOUND_BLOCKS)[number]

/** Required (never removable): the editions block with the "Teklif İste" (quote) actions. */
export const REQUIRED_PRODUCT_BLOCKS: readonly ProductBoundType[] = ['productEditions']
/** Blocks without a "hide" option (no `appearance.hidden` column; render ignores a stored value). */
export const UNHIDEABLE_PRODUCT_BLOCKS: readonly ProductBoundType[] = ['productHero', 'productEditions']

/** Fixed section ids (already in RESERVED_ANCHORS); nav links point to them. */
export const PRODUCT_SECTION_IDS = {
  productOverview: 'genel-bakis',
  productFeatures: 'ozellikler',
  productSpecs: 'teknik-ozellikler',
  productEditions: 'surumler',
  productDownloads: 'indirmeler',
  productDocs: 'dokumantasyon',
} as const satisfies Partial<Record<ProductBoundType, string>>
export type ProductSectionType = keyof typeof PRODUCT_SECTION_IDS
export type ProductSectionId = (typeof PRODUCT_SECTION_IDS)[ProductSectionType]

export const VIRTUAL_ID_PREFIX = 'virtual:'

export const isProductBound = (blockType: unknown): blockType is ProductBoundType =>
  typeof blockType === 'string' && (PRODUCT_BOUND_BLOCKS as readonly string[]).includes(blockType)

type RawBlock = {
  blockType: string
  id?: string | null
  appearance?: { hidden?: boolean | null; animation?: string | null } | null
  showRequirements?: boolean | null
}

const isBlock = (value: unknown): value is RawBlock =>
  !!value && typeof value === 'object' && typeof (value as { blockType?: unknown }).blockType === 'string'

/** What the product has; decides which sections render and which nav links exist. */
export type ProductContent = { summary: boolean; features: boolean; specs: boolean; requirements: boolean }

/**
 * Sections whose pre-V2 markup already animated with the default (`auto`) motion: the hero entrance and the
 * feature cards' item reveal. Every other virtual section renders without motion (pre-V2 markup).
 */
const LEGACY_ANIMATED: readonly ProductBoundType[] = ['productHero', 'productFeatures']

/** A virtual bound block (never stored). */
export function virtualBlock<T extends ProductBoundType>(blockType: T): RawBlock & { blockType: T; id: string } {
  return {
    blockType,
    id: `${VIRTUAL_ID_PREFIX}${blockType}`,
    ...(LEGACY_ANIMATED.includes(blockType) ? {} : { appearance: { animation: 'none' } }),
  }
}
export const isVirtualBlock = (block: { id?: string | null }) => typeof block.id === 'string' && block.id.startsWith(VIRTUAL_ID_PREFIX)

export type ProductComposition<B> = {
  mode: 'compat' | 'composition'
  blocks: (B | ReturnType<typeof virtualBlock>)[]
  /** Section ids in page order, for the sticky nav (visible sections with content only). */
  sections: ProductSectionId[]
}

/** Does the section have something to show for this product? (Editions/downloads/docs always render.) */
export function sectionHasContent(block: RawBlock, content: ProductContent): boolean {
  switch (block.blockType) {
    case 'productOverview': return content.summary
    case 'productFeatures': return content.features
    case 'productSpecs': return content.specs || (block.showRequirements !== false && content.requirements)
    default: return true
  }
}

/**
 * Stored `products.layout` -> the blocks to render, in order. Never throws; unknown/invalid entries are
 * passed through to the render plan (which skips them).
 */
export function composeProductLayout<B extends RawBlock>(layout: readonly B[] | null | undefined, content: ProductContent): ProductComposition<B> {
  const blocks = (Array.isArray(layout) ? layout : []).filter(isBlock) as B[]
  let out: (B | ReturnType<typeof virtualBlock>)[]
  let mode: 'compat' | 'composition'
  if (!blocks.some((b) => isProductBound(b.blockType))) {
    mode = 'compat'
    // Pre-V2 rule: collection fields are the single source, so a duplicate hero/feature grid/spec table is dropped.
    const extra = blocks.filter(
      (b) => b.blockType !== 'hero' && !(b.blockType === 'featureGrid' && content.features) && !(b.blockType === 'specTable' && content.specs),
    )
    out = [...PRODUCT_BOUND_BLOCKS.map((t) => virtualBlock(t)), ...extra]
  } else {
    mode = 'composition'
    const seen = new Set<string>()
    out = []
    for (const b of blocks) {
      if (isProductBound(b.blockType)) {
        if (seen.has(b.blockType)) continue // at most once (validation rejects duplicates)
        seen.add(b.blockType)
        if ((UNHIDEABLE_PRODUCT_BLOCKS as readonly string[]).includes(b.blockType) && b.appearance?.hidden) {
          out.push({ ...b, appearance: { ...b.appearance, hidden: false } })
          continue
        }
      }
      out.push(b)
    }
    const heroAt = out.findIndex((b) => b.blockType === 'productHero')
    if (heroAt === -1) out.unshift(virtualBlock('productHero'))
    else if (heroAt > 0) out.unshift(...out.splice(heroAt, 1))
    if (!seen.has('productEditions')) {
      let lastBound = 0
      out.forEach((b, i) => { if (isProductBound(b.blockType)) lastBound = i })
      out.splice(lastBound + 1, 0, virtualBlock('productEditions'))
    }
  }
  const sections = out.flatMap((b) => {
    if (!Object.hasOwn(PRODUCT_SECTION_IDS, b.blockType) || b.appearance?.hidden === true || !sectionHasContent(b, content)) return []
    return [PRODUCT_SECTION_IDS[b.blockType as ProductSectionType]]
  })
  return { mode, blocks: out, sections }
}

export type ProductLayoutIssue =
  | { code: 'duplicate'; blockType: ProductBoundType }
  | { code: 'requiredMissing'; blockType: ProductBoundType }
  | { code: 'hidden'; blockType: ProductBoundType }
  | { code: 'duplicateID' }

/** Legacy layouts remain valid, but a composition cannot be reset to legacy to remove required blocks. */
export function productLayoutIssues(layout: unknown, previousLayout?: unknown): ProductLayoutIssue[] {
  const previous = (Array.isArray(previousLayout) ? previousLayout : []).filter(isBlock)
  // Payload permits partial block updates by ID; it fills blockType after beforeValidate hooks.
  const blocks = (Array.isArray(layout) ? layout : []).map((b: unknown) => {
    if (b && typeof b === 'object' && !('blockType' in b) && 'id' in b) {
      const old = previous.find((p) => p.id === b.id)
      if (old) return { ...b, blockType: old.blockType }
    }
    return b
  }).filter(isBlock)
  const issues: ProductLayoutIssue[] = []
  const ids = blocks.flatMap((b) => b.id ? [b.id] : [])
  if (new Set(ids).size !== ids.length) issues.push({ code: 'duplicateID' })
  if (![...blocks, ...previous].some((b) => isProductBound(b.blockType))) return issues
  const counts = new Map<ProductBoundType, number>()
  for (const b of blocks) if (isProductBound(b.blockType)) counts.set(b.blockType, (counts.get(b.blockType) ?? 0) + 1)
  for (const [blockType, n] of counts) if (n > 1) issues.push({ code: 'duplicate', blockType })
  for (const blockType of REQUIRED_PRODUCT_BLOCKS) if (!counts.has(blockType)) issues.push({ code: 'requiredMissing', blockType })
  for (const b of blocks) {
    const hidden: unknown = b.appearance?.hidden
    if ((UNHIDEABLE_PRODUCT_BLOCKS as readonly string[]).includes(b.blockType) && (hidden === true || hidden === 'true' || hidden === 1 || hidden === '1'))
      issues.push({ code: 'hidden', blockType: b.blockType as ProductBoundType })
  }
  return issues
}

/**
 * The hero holds the page h1 and breadcrumb, so it is always first. A single hero that sits lower (e.g. just added
 * from the admin block picker, which appends) is moved to the front instead of rejected. Duplicates stay an error.
 */
export function normalizeProductLayout<T>(layout: T, previousLayout?: unknown): T {
  if (!Array.isArray(layout)) return layout
  const previous = (Array.isArray(previousLayout) ? previousLayout : []).filter(isBlock)
  const typeOf = (b: unknown): string | undefined => {
    if (isBlock(b)) return b.blockType
    if (b && typeof b === 'object' && 'id' in b) return previous.find((p) => p.id === (b as { id?: unknown }).id)?.blockType
    return undefined
  }
  const heroes = layout.flatMap((b, i) => (typeOf(b) === 'productHero' ? [i] : []))
  if (heroes.length !== 1 || heroes[0] === 0) return layout
  return [layout[heroes[0]], ...layout.filter((_, i) => i !== heroes[0])] as unknown as T
}

const NAMES: Record<ProductBoundType, [tr: string, en: string]> = {
  productHero: ['Ürün girişi', 'Product hero'],
  productNav: ['Sekme çubuğu', 'Section tabs'],
  productOverview: ['Genel bakış', 'Overview'],
  productFeatures: ['Özellikler', 'Features'],
  productSpecs: ['Teknik özellikler', 'Technical specs'],
  productEditions: ['Sürümler ve Teklif İste', 'Editions and Request a quote'],
  productDownloads: ['İndirmeler', 'Downloads'],
  productDocs: ['Dokümantasyon', 'Documentation'],
}

/** Editor-facing message for an issue (admin language). */
export function productLayoutMessage(issue: ProductLayoutIssue, language?: string): string {
  const en = language === 'en'
  const name = 'blockType' in issue ? NAMES[issue.blockType][en ? 1 : 0] : ''
  switch (issue.code) {
    case 'duplicate':
      return en ? `"${name}" can be used only once on a product page.` : `"${name}" bloğu ürün sayfasında yalnız bir kez kullanılabilir.`
    case 'requiredMissing':
      return en
        ? `"${name}" is required on a product page: it can be moved but not removed.`
        : `"${name}" bloğu ürün sayfasında zorunludur: taşınabilir ama silinemez.`
    case 'hidden':
      return en ? `"${name}" cannot be hidden.` : `"${name}" bloğu gizlenemez.`
    case 'duplicateID':
      return en ? 'Block IDs must be unique within the layout.' : 'Blok kimlikleri sayfa içinde tekil olmalı.'
  }
}

/** `true` or the joined messages (Payload field validator shape). */
export function validateProductLayout(layout: unknown, language?: string, previousLayout?: unknown): true | string {
  const issues = productLayoutIssues(layout, previousLayout)
  return issues.length ? issues.map((i) => productLayoutMessage(i, language)).join(' ') : true
}
