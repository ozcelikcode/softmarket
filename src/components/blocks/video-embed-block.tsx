import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { cn } from '@/lib/utils'
import { toEmbedUrl } from '@/lib/video'
import type { VideoEmbedBlock as Block } from '@/payload-types'

/** Only YouTube (nocookie) and Vimeo are embeddable; anything else renders nothing. */
export function VideoEmbedBlock({ block, ctx }: BlockProps<Block>) {
  const src = toEmbedUrl(block.url)
  if (!src) return null
  const title = block.heading || block.caption || 'Video'
  return (
    <BlockShell blockType="videoEmbed" appearance={ctx.appearance} container={{ size: 'narrow', className: 'max-w-[60rem]' }}>
      {block.heading ? <Heading size="h2" className={cn('mb-8', alignClass(ctx.appearance))}>{block.heading}</Heading> : null}
      <div className="aspect-video overflow-hidden rounded-xl border border-border bg-surface">
        <iframe
          src={src}
          title={title}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full"
        />
      </div>
      {block.caption ? <p className={cn('mt-3 text-small text-muted', alignClass(ctx.appearance))}>{block.caption}</p> : null}
    </BlockShell>
  )
}
