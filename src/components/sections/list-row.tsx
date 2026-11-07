import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Compact horizontal row for the "list" layout of list blocks (icon or thumbnail, title, summary). */
export function ListRow({
  href, locale, title, description, icon, image, badge, meta, className,
}: {
  href: string
  locale: string
  title: string
  description?: string | null
  icon?: ReactNode
  image?: ReactNode
  badge?: string | null
  meta?: ReactNode
  className?: string
}) {
  return (
    <AppLink
      href={href}
      locale={locale}
      className={cn(
        'card-hover group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 hover:border-border-strong hover:bg-surface-2 sm:gap-5 sm:p-5',
        className,
      )}
    >
      {image ? (
        <span className="block h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border sm:h-16 sm:w-24">{image}</span>
      ) : icon ? (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-accent [&_svg]:size-5">{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1">
        {meta ? <span className="mb-1 block text-small text-muted">{meta}</span> : null}
        <h3 className="text-h4 text-text break-words">{title}</h3>
        {description ? <span className="mt-1 line-clamp-2 block text-small text-muted">{description}</span> : null}
      </span>
      {badge ? <Badge variant="accent" className="hidden shrink-0 sm:inline-flex">{badge}</Badge> : null}
      <ArrowUpRight aria-hidden className="size-4 shrink-0 text-accent transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </AppLink>
  )
}
