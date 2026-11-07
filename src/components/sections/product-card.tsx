import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  description?: string
  href: string
  locale: string
  badge?: string
  icon?: ReactNode
  image?: ReactNode
  className?: string
  headingAs?: 'h2' | 'h3'
}

export function ProductCard({ title, description, href, locale, badge, icon, image, className, headingAs: HeadingTag = 'h3' }: Props) {
  return (
    <AppLink
      href={href}
      locale={locale}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors duration-200 hover:border-border-strong hover:bg-surface-2',
        className,
      )}
    >
      {image ? <div className="aspect-[16/10] overflow-hidden border-b border-border">{image}</div> : null}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          {icon ? (
            <span className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-bg text-accent [&_svg]:size-5">
              {icon}
            </span>
          ) : (
            <span />
          )}
          {badge ? <Badge variant="accent">{badge}</Badge> : null}
        </div>
        <HeadingTag className="mt-6 text-h3 text-text">{title}</HeadingTag>
        {description ? <p className="mt-2 flex-1 text-small text-muted">{description}</p> : null}
        <span className="mt-6 inline-flex items-center gap-1 text-small font-medium text-accent">
          <ArrowUpRight
            aria-hidden
            className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </AppLink>
  )
}
