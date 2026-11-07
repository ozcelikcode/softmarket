import { getBlockRenderer, hasBlockRenderer } from '@/components/blocks/registry'
import type { LayoutBlock } from '@/components/blocks/types'
import { planBlocks } from '@/lib/blocks/render-plan'

export type { LayoutBlock } from '@/components/blocks/types'

/**
 * Renders a Payload `layout` field through the block registry. Unknown and hidden blocks are skipped,
 * never thrown on. `firstHeroH1`: set only where the page has no h1 of its own (CMS-driven page top);
 * pages with a PageHero keep every hero block at h2, so a page always has exactly one h1.
 */
export function RenderBlocks({ blocks, locale, firstHeroH1 = false }: { blocks?: LayoutBlock[] | null; locale: string; firstHeroH1?: boolean }) {
  const planned = planBlocks(blocks, { firstHeroH1, isKnown: hasBlockRenderer })
  if (!planned.length) return null
  return (
    <>
      {planned.map(({ block, key, ctx }) => {
        const Block = getBlockRenderer(block.blockType)
        return Block ? <Block key={key} block={block} locale={locale} ctx={ctx} /> : null
      })}
    </>
  )
}
