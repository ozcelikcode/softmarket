import { resolveAppearance, type ResolvedAppearance } from '@/fields/block-settings'

/** Per-block render context computed once for the whole page (pure; no React). */
export type BlockContext = {
  appearance: ResolvedAppearance
  /** Position among rendered (visible, known) blocks. */
  index: number
  /** Heading level of a hero block: the page's single h1, or a section h2. */
  headingAs: 'h1' | 'h2'
  /** First block of a page whose top is CMS-driven (it sits under the fixed header). */
  pageTop: boolean
}

export type PlannedBlock<B> = { block: B; key: string; ctx: BlockContext }

type PlannableBlock = { blockType: string; id?: string | null; appearance?: unknown }

export type PlanOptions = {
  /**
   * The page has no h1 of its own (CMS-driven page top, F6): the first visible hero becomes the h1 and the
   * first block gets header clearance. Pages that render a PageHero leave this off, so every hero is h2.
   */
  firstHeroH1?: boolean
  /** Block types that have a renderer; unknown types are skipped (never thrown on). */
  isKnown?: (blockType: string) => boolean
}

/**
 * Filters hidden/unknown blocks, assigns the single h1 and de-duplicates anchors (an id appears at most once
 * in the HTML even if stored data bypassed validation).
 */
export function planBlocks<B extends PlannableBlock>(blocks: readonly B[] | null | undefined, options: PlanOptions = {}): PlannedBlock<B>[] {
  const { firstHeroH1 = false, isKnown = () => true } = options
  const visible = (blocks ?? []).flatMap((block) => {
    if (!block || typeof block.blockType !== 'string' || !isKnown(block.blockType)) return []
    const appearance = resolveAppearance(block as Parameters<typeof resolveAppearance>[0])
    return appearance.hidden ? [] : [{ block, appearance }]
  })
  const h1Index = firstHeroH1 ? visible.findIndex(({ block }) => block.blockType === 'hero') : -1
  const seen = new Set<string>()
  return visible.map(({ block, appearance }, index) => {
    let resolved = appearance
    if (appearance.anchor) {
      if (seen.has(appearance.anchor)) {
        const { anchor: _duplicate, ...rest } = appearance
        resolved = rest
      } else seen.add(appearance.anchor)
    }
    return {
      block,
      key: block.id ?? `${block.blockType}-${index}`,
      ctx: { appearance: resolved, index, headingAs: index === h1Index ? 'h1' : 'h2', pageTop: firstHeroH1 && index === 0 },
    }
  })
}
