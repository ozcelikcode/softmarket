import { getTranslations } from 'next-intl/server'

import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { VideoFacade } from '@/components/blocks/video-facade'
import { Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { cn } from '@/lib/utils'
import { toEmbedUrl } from '@/lib/video'
import type { VideoEmbedBlock as Block } from '@/payload-types'

/**
 * Only YouTube (nocookie) and Vimeo (dnt) are embeddable; anything else renders nothing. Facade: the page
 * carries the poster + play button, the provider iframe is created only after the click.
 */
export async function VideoEmbedBlock({ block, locale, ctx }: BlockProps<Block>) {
  const src = toEmbedUrl(block.url)
  if (!src) return null
  const c = await getTranslations({ locale, namespace: 'common' })
  const title = block.heading || block.caption || 'Video'
  return (
    <BlockShell blockType="videoEmbed" appearance={ctx.appearance} motion={ctx.motion} container={{ size: 'narrow', className: 'max-w-[60rem]' }}>
      {block.heading ? <Heading size="h2" className={cn('mb-8', alignClass(ctx.appearance))}>{block.heading}</Heading> : null}
      <VideoFacade
        embedUrl={src}
        title={title}
        playLabel={c('playVideo')}
        poster={<MediaImage media={block.poster} alt="" sizes="(min-width: 1024px) 60rem, 100vw" className="absolute inset-0" />}
      />
      {block.caption ? <p className={cn('mt-3 text-small text-muted', alignClass(ctx.appearance))}>{block.caption}</p> : null}
    </BlockShell>
  )
}
