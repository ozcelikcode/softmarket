import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { resolveLink, type LinkGroup } from '@/lib/site'

type ActionRow = { link?: LinkGroup; id?: string | null }
type Appearance = 'primary' | 'secondary' | 'link' | null | undefined

/** CMS link rows -> buttons. Rows without a resolvable, safe target are dropped. */
export function Actions({ actions, locale }: { actions?: ActionRow[] | null; locale: string }) {
  const rows = (actions ?? []).flatMap((a, i) => {
    const link = resolveLink(a.link)
    return link ? [{ link, key: a.id ?? String(i), appearance: (a.link as { appearance?: Appearance } | null)?.appearance }] : []
  })
  if (!rows.length) return null
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      {rows.map(({ link, key, appearance }) => (
        <Button key={key} asChild size="lg" variant={appearance === 'secondary' ? 'secondary' : appearance === 'link' ? 'link' : 'primary'}>
          <AppLink href={link.href} locale={locale} target={link.newTab ? '_blank' : undefined}>
            {link.label}
          </AppLink>
        </Button>
      ))}
    </div>
  )
}
