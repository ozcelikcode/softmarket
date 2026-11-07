import { getBlockRenderer, hasBlockRenderer } from '@/components/blocks/registry'
import type { BlockSlots, LayoutBlock } from '@/components/blocks/types'
import { preloadBlockData } from '@/lib/blocks/data'
import { planBlocks } from '@/lib/blocks/render-plan'

export type { LayoutBlock } from '@/components/blocks/types'

/**
 * Renders a Payload `layout` field through the block registry. Unknown and hidden blocks are skipped,
 * never thrown on. `firstHeroH1`: set only where the page has no h1 of its own (CMS-driven page top);
 * pages with a PageHero keep every hero block at h2, so a page always has exactly one h1.
 */
export function RenderBlocks({ blocks, locale, firstHeroH1 = false, slots }: {
  blocks?: readonly LayoutBlock[] | null
  locale: string
  firstHeroH1?: boolean
  /** Content for placeholder blocks (`listing`); without it those blocks render nothing. */
  slots?: BlockSlots
}) {
  const planned = planBlocks(blocks, { firstHeroH1, isKnown: hasBlockRenderer })
  if (!planned.length) return null
  // Start every data-bound block's fetch now; blocks then join the in-flight (cached) requests.
  preloadBlockData(planned.map(({ block }) => block), locale)
  return (
    <>
      {planned.map(({ block, key, ctx }) => {
        const Block = getBlockRenderer(block.blockType)
        return Block ? <Block key={key} block={block} locale={locale} ctx={ctx} slots={slots} /> : null
      })}
    </>
  )
}
