import { preload } from 'react-dom'
import { CARD_IMAGE_SIZES, containerImageSizes } from '@/lib/media-layout'
import { imageCandidates, mediaOf } from '@/lib/media-image'
import { cn } from '@/lib/utils'

/** Native responsive images keep every request behind Payload access, without optimizer caching. */
export function MediaImage({ media, className, sizes, priority, alt }: {
  media: unknown
  className?: string
  sizes?: string
  priority?: boolean
  alt?: string
}) {
  const m = mediaOf(media)
  if (!m) return null
  const candidates = imageCandidates(m)
  const src = candidates.at(-1)?.url ?? m.url!
  const srcSet = candidates.length ? candidates.map(s => `${s.url} ${s.width}w`).join(', ') : undefined
  const imageSizes = sizes ?? (priority ? containerImageSizes('normal', 2) : CARD_IMAGE_SIZES)
  if (priority) preload(src, { as: 'image', imageSrcSet: srcSet, imageSizes, fetchPriority: 'high' })
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      alt={alt ?? m.alt ?? ''}
      width={m.width || 1600}
      height={m.height || 900}
      sizes={imageSizes}
      fetchPriority={priority ? 'high' : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={m.focalX != null && m.focalY != null ? { objectPosition: `${m.focalX}% ${m.focalY}%` } : undefined}
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
