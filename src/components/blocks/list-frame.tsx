import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Eyebrow, SectionHeading } from '@/components/ui/heading'
import { editText, fieldAttrs } from '@/components/blocks/block-shell'
import type { ResolvedAppearance } from '@/fields/block-settings'
import type { BlockContext } from '@/lib/blocks/render-plan'
import { cn } from '@/lib/utils'

type ViewAll = { href: string; label: string } | null
type Attrs = ReturnType<typeof fieldAttrs>

function ViewAllButton({ viewAll, locale, attrs }: { viewAll: NonNullable<ViewAll>; locale: string; attrs?: Attrs }) {
  return (
    <Button asChild variant="secondary">
      <AppLink href={viewAll.href} locale={locale}>{attrs?.['data-field-path'] ? <span {...attrs}>{viewAll.label}</span> : viewAll.label}<ArrowRight aria-hidden /></AppLink>
    </Button>
  )
}

/**
 * Heading copy + "view all" link around the items of a list block. Start-aligned: link sits beside the
 * heading (wraps on mobile); centered: heading is centered and the link sits under the items.
 */
export function ListFrame({
  locale, appearance, eyebrow, heading, description, viewAll, children, ctx, viewAllLabel,
}: {
  locale: string
  appearance: ResolvedAppearance
  eyebrow?: string | null
  heading?: string | null
  description?: string | null
  viewAll: ViewAll
  children: ReactNode
  /** V5 visual editor markers (editing renders only): eyebrow/heading/description/viewAllLabel. */
  ctx?: Pick<BlockContext, 'edit'>
  /** Stored custom "view all" label (marked only when the CMS value is shown). */
  viewAllLabel?: string | null
}) {
  const e = (path: string, value: string | null | undefined) => (ctx ? editText(ctx, path, value) : value)
  const viewAttrs = ctx && viewAllLabel?.trim() && viewAll?.label === viewAllLabel.trim() ? fieldAttrs(ctx, 'viewAllLabel') : undefined
  const center = appearance.align === 'center'
  const hasCopy = Boolean(eyebrow || heading || description)
  const linkBeside = Boolean(viewAll) && !center
  return (
    <>
      {hasCopy || linkBeside ? (
        <div className={cn('flex flex-wrap items-end gap-6', hasCopy ? 'justify-between' : 'justify-end', center && 'justify-center')}>
          {heading ? (
            <SectionHeading eyebrow={e('eyebrow', eyebrow)} title={e('heading', heading)} lead={e('description', description)} align={center ? 'center' : 'left'} />
          ) : hasCopy ? (
            <div className={cn('max-w-3xl', center && 'mx-auto text-center')}>
              {eyebrow ? <Eyebrow>{e('eyebrow', eyebrow)}</Eyebrow> : null}
              {description ? <p className={cn('text-lead text-muted text-pretty', eyebrow && 'mt-4')}>{e('description', description)}</p> : null}
            </div>
          ) : null}
          {linkBeside && viewAll ? <ViewAllButton viewAll={viewAll} locale={locale} attrs={viewAttrs} /> : null}
        </div>
      ) : null}
      <div className={hasCopy || linkBeside ? 'mt-14' : undefined}>{children}</div>
      {viewAll && center ? <div className="mt-10 flex justify-center"><ViewAllButton viewAll={viewAll} locale={locale} attrs={viewAttrs} /></div> : null}
    </>
  )
}
