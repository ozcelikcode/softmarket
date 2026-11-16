import { ArrowRight } from 'lucide-react'

import { editText } from '@/components/blocks/block-shell'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import type { BlockContext } from '@/lib/blocks/render-plan'
import { resolveLink, type LinkGroup } from '@/lib/site'
import { cn } from '@/lib/utils'

type ActionRow = { link?: LinkGroup; id?: string | null }
type Appearance = 'primary' | 'secondary' | 'link' | null | undefined

/** CMS link rows -> buttons. Rows without a resolvable, safe target are dropped. */
/** `fallback` renders one primary button when no row resolves (e.g. placeholder mailto targets are dropped). */
export function Actions({ actions, locale, fallback, className = 'mt-8', arrowOnSecondary = false, ctx }: {
  actions?: ActionRow[] | null
  locale: string
  fallback?: { label: string; href: string }
  /** Spacing above the button row (blocks match their hand-built predecessors). */
  className?: string
  /** Navigational secondary buttons carry a trailing arrow (hero, as on the pre-F6 home). */
  arrowOnSecondary?: boolean
  /** V5 visual editor: marks `actions.N.link.label` (stored row index) in editing renders. */
  ctx?: Pick<BlockContext, 'edit'>
}) {
  const rows = (actions ?? []).flatMap((a, i) => {
    const link = resolveLink(a.link)
    return link ? [{ link, key: a.id ?? String(i), at: i, own: Boolean(a.link?.label), appearance: (a.link as { appearance?: Appearance } | null)?.appearance }] : []
  })
  if (!rows.length) {
    if (!fallback) return null
    return (
      <div className={cn(className, 'flex flex-wrap items-center gap-3')}>
        <Button asChild size="lg"><AppLink href={fallback.href} locale={locale}>{fallback.label}</AppLink></Button>
      </div>
    )
  }
  return (
    <div className={cn(className, 'flex flex-wrap items-center gap-3')}>
      {rows.map(({ link, key, at, own, appearance }) => (
        <Button key={key} asChild size="lg" variant={appearance === 'secondary' ? 'secondary' : appearance === 'link' ? 'link' : 'primary'}>
          <AppLink href={link.href} locale={locale} target={link.newTab ? '_blank' : undefined}>
            {ctx && own ? editText(ctx, `actions.${at}.link.label`, link.label) : link.label}
            {arrowOnSecondary && appearance === 'secondary' ? <ArrowRight aria-hidden /> : null}
          </AppLink>
        </Button>
      ))}
    </div>
  )
}
