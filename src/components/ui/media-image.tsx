import Image from 'next/image'

import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'

/** Renders a populated CMS media relation; renders nothing when it is an ID or not readable. */
export function MediaImage({
  media,
  className,
  sizes,
  priority,
  alt,
}: {
  media: unknown
  className?: string
  sizes?: string
  priority?: boolean
  alt?: string
}) {
  const m = mediaOf(media)
  if (!m) return null
  return (
    <Image
      src={m.url!}
      alt={alt ?? m.alt ?? ''}
      width={m.width || 1600}
      height={m.height || 900}
      sizes={sizes ?? '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw'}
      priority={priority}
      // Payload access can change at the same URL. Never retain protected bytes in
      // the optimizer's shared cache (including files that were previously public).
      unoptimized
      loading={priority ? undefined : 'lazy'}
      decoding="async"
      className={cn('h-full w-full object-cover', className)}
    />
  )
}
