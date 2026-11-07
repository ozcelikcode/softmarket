'use client'

import { usePathname } from 'next/navigation'

import { AppLink } from '@/components/ui/app-link'
import { canonicalPortalPath } from '@/lib/portal/redirect'
import { cn } from '@/lib/utils'

export type PortalNavItem = { href: string; label: string }

/** Section navigation; the active item is derived from the canonical form of the URL. */
export function PortalNav({ items, locale, label }: { items: PortalNavItem[]; locale: string; label: string }) {
  const current = canonicalPortalPath(usePathname()).replace(/\/$/, '')
  return (
    <nav aria-label={label} className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {items.map((item) => {
          const active = item.href === '/hesap' ? current === '/hesap' : current === item.href || current.startsWith(`${item.href}/`)
          return (
            <li key={item.href}>
              <AppLink
                href={item.href}
                locale={locale}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-11 items-center border-b-2 px-3.5 text-small font-medium transition-colors',
                  active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text',
                )}
              >
                {item.label}
              </AppLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
