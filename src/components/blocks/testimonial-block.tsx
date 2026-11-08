import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { MediaImage } from '@/components/ui/media-image'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { TestimonialBlock as Block } from '@/payload-types'

export function TestimonialBlock({ block, ctx }: BlockProps<Block>) {
  if (!block.quote) return null
  const center = ctx.appearance.align === 'center'
  const photo = mediaOf(block.photo)
  const logo = mediaOf(block.logo)
  const byline = [block.role, block.company].filter(Boolean).join(' · ')
  return (
    <BlockShell blockType="testimonial" appearance={ctx.appearance} motion={ctx.motion} container={{ size: 'narrow' }}>
      <figure className={alignClass(ctx.appearance)}>
        <blockquote className="text-h3 font-medium text-text text-balance break-words">
          <span aria-hidden className="mr-1 text-accent">&ldquo;</span>
          {block.quote}
          <span aria-hidden className="ml-1 text-accent">&rdquo;</span>
        </blockquote>
        <figcaption className={cn('mt-8 flex flex-wrap items-center gap-4', center && 'justify-center')}>
          {photo ? <MediaImage media={photo} alt={photo.alt?.trim() || block.name} sizes="48px" className="size-12 shrink-0 rounded-full border border-border" /> : null}
          <span className={cn('min-w-0', center ? 'text-center' : 'text-left')}>
            <span className="block font-semibold text-text">{block.name}</span>
            {byline ? <span className="block text-small text-muted">{byline}</span> : null}
          </span>
          {logo ? <MediaImage media={logo} alt={block.company?.trim() || logo.alt} sizes="160px" className="h-8 w-auto max-w-40 object-contain opacity-80" /> : null}
        </figcaption>
      </figure>
    </BlockShell>
  )
}
