import { LCP_BLOCK_TYPES, resolveMotion, type ResolvedMotion } from '@/fields/block-motion'
import { resolveAppearance, type ResolvedAppearance } from '@/fields/block-settings'

/** Per-block render context computed once for the whole page (pure; no React). */
export type BlockContext = {
  appearance: ResolvedAppearance
  /**
   * V1 motion preset. LCP rule: the first visible block and every hero are `protect`ed, so a hiding preset
   * (opacity 0 / scale) is downgraded to a translate-only entrance on the server (see `resolveMotion`).
   */
  motion: ResolvedMotion
  /** Position among rendered (visible, known) blocks. */
  index: number
  /** Heading level of a hero block: the page's single h1, or a section h2. */
  headingAs: 'h1' | 'h2'
  /** First block of a page whose top is CMS-driven (it sits under the fixed header). */
  pageTop: boolean
}

export type PlannedBlock<B> = { block: B; key: string; ctx: BlockContext }

type PlannableBlock = { blockType: string; id?: string | null; appearance?: unknown; motion?: unknown; heading?: unknown; content?: unknown }

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0

/** Conservative proof of visible content; invalid/empty Lexical and unresolved media never consume it. */
function hasIntroContent(block: PlannableBlock): boolean {
  // CTA always renders a translated fallback action, even when its heading/actions are empty.
  if (block.blockType === 'cta') return true
  if (block.blockType === 'hero' || block.blockType === 'mediaText') return hasText(block.heading)
  if (block.blockType !== 'richText') return false
  const root = (block.content as { root?: { children?: unknown } } | null)?.root
  if (!Array.isArray(root?.children)) return false
  const stack: unknown[] = root.children.slice(0, 256)
  // Malformed/very deep content may only cause extra protection, never unbounded traversal.
  for (let remaining = 256; stack.length && remaining > 0; remaining--) {
    const node = stack.pop() as { type?: unknown; text?: unknown; children?: unknown } | null
    if (!node || typeof node !== 'object') continue
    if (node.type === 'text' && hasText(node.text)) return true
    if (typeof node.type === 'string' && ['paragraph', 'heading', 'quote', 'list', 'listitem', 'link', 'autolink'].includes(node.type) && Array.isArray(node.children)) {
      for (const child of node.children.slice(0, remaining)) stack.push(child)
    }
  }
  return false
}

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
  // Data-bound/conditional blocks can return null (including empty queries), and spacers/dividers or
  // missing listing slots provide no LCP content. Protect candidates until a content wrapper is certain
  // to render; guessing from the stored index would let an empty predecessor bypass LCP protection.
  let hasContentBefore = false
  return visible.map(({ block, appearance }, index) => {
    let resolved = appearance
    if (appearance.anchor) {
      if (seen.has(appearance.anchor)) {
        const { anchor: _duplicate, ...rest } = appearance
        resolved = rest
      } else seen.add(appearance.anchor)
    }
    const motion = resolveMotion(block as Parameters<typeof resolveMotion>[0], {
      animation: resolved.animation,
      protect: !hasContentBefore || LCP_BLOCK_TYPES.includes(block.blockType),
    })
    if (hasIntroContent(block)) hasContentBefore = true
    return {
      block,
      key: block.id ?? `${block.blockType}-${index}`,
      ctx: { appearance: resolved, motion, index, headingAs: index === h1Index ? 'h1' : 'h2', pageTop: firstHeroH1 && index === 0 },
    }
  })
}
