import { AppLink } from '@/components/ui/app-link'
import { orderDocTree, type DocNode } from '@/lib/support'

export function DocSidebar({
  docs,
  product,
  locale,
  current,
  label,
}: {
  docs: DocNode[]
  product: string
  locale: string
  current?: number
  label: string
}) {
  return (
    <nav
      aria-label={label}
      className="rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24"
    >
      <h2 className="mb-3 font-semibold">{label}</h2>
      <ul className="space-y-1">
        {orderDocTree(docs).map((d) => (
          <li key={d.id} style={{ paddingInlineStart: `${Math.min(d.level, 6) * 12}px` }}>
            <AppLink
              locale={locale}
              href={`/destek/dokumantasyon/${encodeURIComponent(product)}/${encodeURIComponent(d.slug!)}`}
              aria-current={current === d.id ? 'page' : undefined}
              className="block rounded-sm py-2 text-small hover:text-accent aria-[current=page]:font-semibold aria-[current=page]:text-accent"
            >
              {d.title}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
