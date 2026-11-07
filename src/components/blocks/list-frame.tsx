import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Eyebrow, SectionHeading } from '@/components/ui/heading'
import type { ResolvedAppearance } from '@/fields/block-settings'
import { cn } from '@/lib/utils'

type ViewAll = { href: string; label: string } | null

function ViewAllButton({ viewAll, locale }: { viewAll: NonNullable<ViewAll>; locale: string }) {
  return (
    <Button asChild variant="secondary">
      <AppLink href={viewAll.href} locale={locale}>{viewAll.label}<ArrowRight aria-hidden /></AppLink>
    </Button>
  )
}

/**
 * Heading copy + "view all" link around the items of a list block. Start-aligned: link sits beside the
 * heading (wraps on mobile); centered: heading is centered and the link sits under the items.
 */
export function ListFrame({
  locale, appearance, eyebrow, heading, description, viewAll, children,
}: {
  locale: string
  appearance: ResolvedAppearance
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  viewAll: ViewAll
  children: ReactNode
}) {
  const center = appearance.align === 'center'
  const hasCopy = Boolean(eyebrow || heading || description)
  const linkBeside = Boolean(viewAll) && !center
  return (
    <>
      {hasCopy || linkBeside ? (
        <div className={cn('flex flex-wrap items-end gap-6', hasCopy ? 'justify-between' : 'justify-end', center && 'justify-center')}>
          {heading ? (
            <SectionHeading eyebrow={eyebrow} title={heading} lead={description} align={center ? 'center' : 'left'} />
          ) : hasCopy ? (
            <div className={cn('max-w-3xl', center && 'mx-auto text-center')}>
              {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
              {description ? <p className={cn('text-lead text-muted text-pretty', eyebrow && 'mt-4')}>{description}</p> : null}
            </div>
          ) : null}
          {linkBeside && viewAll ? <ViewAllButton viewAll={viewAll} locale={locale} /> : null}
        </div>
      ) : null}
      <div className={hasCopy || linkBeside ? 'mt-14' : undefined}>{children}</div>
      {viewAll && center ? <div className="mt-10 flex justify-center"><ViewAllButton viewAll={viewAll} locale={locale} /></div> : null}
    </>
  )
}
