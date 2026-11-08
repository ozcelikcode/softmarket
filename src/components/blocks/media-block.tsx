import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { aspectClass } from '@/lib/blocks/static'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { MediaBlock as Block } from '@/payload-types'

/** One full-width figure, or a 2-4 image grid. Fixed aspect crops (object-cover); `auto` keeps the file's ratio. */
export function MediaBlock({ block, ctx }: BlockProps<Block>) {
  const items = (block.items ?? []).filter((it) => mediaOf(it.image))
  if (!items.length) return null
  const ratio = aspectClass(block.aspect)
  const count = items.length
  const sizes = count === 1 ? '(min-width: 1280px) 75rem, 100vw' : count === 2 ? '(min-width: 640px) 50vw, 100vw' : '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw'
  return (
    <BlockShell blockType="media" appearance={ctx.appearance} motion={ctx.motion}>
      {block.heading ? <Heading size="h2" className={cn('mb-8', alignClass(ctx.appearance))}>{block.heading}</Heading> : null}
      <div className={cn('grid gap-6', count === 2 && 'sm:grid-cols-2', count === 3 && 'sm:grid-cols-2 lg:grid-cols-3', count === 4 && 'sm:grid-cols-2 lg:grid-cols-4')}>
        {items.map((it, i) => (
          <figure key={it.id ?? i} className="min-w-0">
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <MediaImage media={it.image} sizes={sizes} className={ratio ?? 'h-auto'} />
            </div>
            {it.caption ? <figcaption className={cn('mt-3 text-small text-muted', alignClass(ctx.appearance))}>{it.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
    </BlockShell>
  )
}
