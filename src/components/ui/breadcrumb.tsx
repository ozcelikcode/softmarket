import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { cn } from '@/lib/utils'

export type Crumb = { label: string; href?: string }

export function Breadcrumb({
  items,
  locale,
  label,
  className,
}: {
  items: Crumb[]
  locale: string
  label: string
  className?: string
}) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-small text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="flex items-center gap-1.5">
                {item.href && !last ? (
                  <AppLink
                    href={item.href}
                    locale={locale}
                    className={cn('inline-flex min-h-11 items-center rounded-sm hover:text-text lg:min-h-0')}
                  >
                    {item.label}
                  </AppLink>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={last ? 'text-text' : ''}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className="flex">
                  <ChevronRight className="size-3.5" />
                </li>
              ) : null}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
