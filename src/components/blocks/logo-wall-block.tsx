import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { LogoWall, type Logo } from '@/components/sections/logo-wall'
import { mediaOf, relOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { CaseStudy, LogoWallBlock as Block, Partner } from '@/payload-types'

export function LogoWallBlock({ block, ctx }: BlockProps<Block>) {
  const logos: Logo[] = []
  const push = (name: string | undefined, media: unknown) => {
    if (!name) return
    const m = mediaOf(media)
    logos.push({ name, src: m?.url ?? undefined, alt: name })
  }
  if (block.source === 'caseStudies') {
    for (const c of block.caseStudies ?? []) { const cs = relOf<CaseStudy>(c); if (cs) push(cs.customerName, cs.customerLogo) }
  } else if (block.source === 'partners') {
    for (const p of block.partners ?? []) { const pa = relOf<Partner>(p); if (pa) push(pa.name, pa.logo) }
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
