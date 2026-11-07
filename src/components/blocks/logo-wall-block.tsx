import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { LogoWall, type Logo } from '@/components/sections/logo-wall'
import { loadLogos } from '@/lib/blocks/data'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { LogoWallBlock as Block } from '@/payload-types'

export async function LogoWallBlock({ block, locale, ctx }: BlockProps<Block>) {
  const logos: Logo[] = []
  const push = (name: string | undefined, media: unknown) => {
    if (!name) return
    const m = mediaOf(media)
    logos.push({ name, media: m, alt: name })
  }
  if (block.source === 'allPartners' || block.source === 'allCaseStudies' || block.source === 'partnersAndCaseStudies' || block.source === 'caseStudies' || block.source === 'partners') {
    // Selected legacy sources also re-read IDs with anonymous access. Keep their text-only logos.
    for (const l of await loadLogos(locale, block)) push(l.name, l.media)
  } else {
    for (const l of block.logos ?? []) push(l.name, l.logo)
  }
  if (!logos.length) return null
  return (
    <BlockShell blockType="logoWall" appearance={ctx.appearance} className="border-y border-border">
      {block.heading ? <p className={cn('mb-8 text-small text-muted', alignClass(ctx.appearance))}>{block.heading}</p> : null}
      <LogoWall logos={logos} />
    </BlockShell>
  )
}
