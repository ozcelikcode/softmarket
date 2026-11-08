import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { MediaImage } from '@/components/ui/media-image'
import { placeholderCover } from '@/lib/cover'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'

/** Editorial card (news, case study, solution): optional image, meta line, title, summary. */
export function MediaCard({
  href, locale, title, description, image, meta, badge, logo, className, headingAs: HeadingTag = 'h3',
}: {
  href: string
  locale: string
  title: string
  description?: string | null
  image?: unknown
  meta?: ReactNode
  badge?: string | null
  logo?: ReactNode
  className?: string
  headingAs?: 'h2' | 'h3'
}) {
  const cover = placeholderCover(href)
  return (
    <AppLink
      href={href}
      locale={locale}
      className={cn(
        'card-hover group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface hover:border-border-strong hover:bg-surface-2',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b border-border bg-surface-2">
        {mediaOf(image) ? (
          <MediaImage media={image} sizes="(min-width: 1024px) 33vw, 100vw" className="transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : !logo ? (
          // Branded placeholder (pure CSS, no request): accent glow + fine diagonal lines + wordmark glyph.
          <div aria-hidden className="bg-brand-pattern absolute inset-0 flex items-center justify-center" style={cover.style}>
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border-strong/40 bg-bg/40 text-accent">
              <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d={cover.glyph} /></svg>
            </span>
          </div>
        ) : null}
        {logo ? <div className="absolute inset-0 flex items-center justify-center p-8">{logo}</div> : null}
        {badge ? <Badge variant="accent" className="absolute left-4 top-4 bg-bg/80 backdrop-blur">{badge}</Badge> : null}
      </div>
      <div className="flex flex-1 flex-col p-6">
        {meta ? <div className="mb-2 text-small text-muted">{meta}</div> : null}
        <HeadingTag className="text-h3 text-text text-balance">{title}</HeadingTag>
        {description ? <p className="mt-2 line-clamp-3 flex-1 text-small text-muted">{description}</p> : <span className="flex-1" />}
        <ArrowUpRight aria-hidden className="mt-5 size-4 text-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </AppLink>
  )
}
