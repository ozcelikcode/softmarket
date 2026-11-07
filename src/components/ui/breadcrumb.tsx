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
      <ol className="flex min-w-0 items-center gap-1.5 text-small text-muted sm:flex-wrap">
        {items.map((item, i) => {
          const last = i === items.length - 1
          // Narrow screens: show only the parent and the current page so the trail stays on one line.
          const far = i < items.length - 2
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className={cn('min-w-0 items-center gap-1.5', far ? 'hidden sm:flex' : 'flex')}>
                {item.href && !last ? (
                  <AppLink
                    href={item.href}
                    locale={locale}
                    className="inline-flex min-h-11 min-w-0 items-center rounded-sm hover:text-text lg:min-h-0"
                  >
                    <span className="truncate">{item.label}</span>
                  </AppLink>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={cn(last && 'truncate text-text')}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last ? (
                <li aria-hidden className={cn('shrink-0', far ? 'hidden sm:flex' : 'flex')}>
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
