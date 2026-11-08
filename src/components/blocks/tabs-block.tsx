import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import { RichContent } from '@/components/blocks/rich-text'
import { TabsIsland } from '@/components/blocks/tabs-island'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { TabsBlock as Block } from '@/payload-types'

/** Panels render on the server (rich text stays RSC); the island only handles selection and keyboard. */
export function TabsBlock({ block, locale, ctx }: BlockProps<Block>) {
  const items = (block.items ?? []).filter((it) => it.label)
  if (!items.length) return null
  const headingId = block.heading ? `tabs-${ctx.index}-heading` : undefined
  const tabs = items.map((it) => ({
    label: it.label,
    content: (
      <div className={cn(mediaOf(it.media) && 'grid items-center gap-10 lg:grid-cols-2')}>
        {it.content ? <RichContent data={it.content} locale={locale} /> : <span />}
        {mediaOf(it.media) ? (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <MediaImage media={it.media} sizes="(min-width: 1024px) 40rem, 100vw" className="aspect-[4/3]" />
          </div>
        ) : null}
      </div>
    ),
  }))
  return (
    <BlockShell blockType="tabs" appearance={ctx.appearance} motion={ctx.motion}>
      {block.heading ? <Heading id={headingId} size="h2" className={cn('mb-8', alignClass(ctx.appearance))}>{block.heading}</Heading> : null}
      <TabsIsland tabs={tabs} labelledBy={headingId} />
    </BlockShell>
  )
}
