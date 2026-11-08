import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupportFrame } from '@/components/sections/support-frame'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportFilters } from '@/components/sections/support-filters'
import { RichContent } from '@/components/blocks/rich-text'
import { getReleases, getSupportProducts } from '@/lib/support'
import { boundedQuery } from '@/lib/support-query'
import { relOf } from '@/lib/content'
import { formatDate } from '@/lib/format'
import type { Product, Release } from '@/payload-types'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Locale } from '@/i18n/routing'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek/surum-notlari', title: t('releases') })
}

function ReleaseCard({ release: r, locale, badge, compact }: { release: Release; locale: Locale; badge?: string; compact?: boolean }) {
  const meta = [formatDate(r.releaseDate, locale), r.channel].filter(Boolean).join(' · ')
  return (
    <article className={compact ? 'rounded-md border border-border bg-surface-2 p-5' : 'rounded-lg border border-border bg-surface p-6 sm:p-8'}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className={compact ? 'font-mono text-h4 text-text' : 'font-mono text-h3 text-text'}>{r.version}</h3>
        {badge ? <Badge variant="accent">{badge}</Badge> : null}
        <p className="text-small text-muted">{meta}</p>
      </div>
      {r.title ? <p className="mt-2 text-body font-medium text-text">{r.title}</p> : null}
      <div className="mt-4"><RichContent locale={locale} data={r.notes} /></div>
      {r.changes?.length ? (
        <ul className="mt-4 list-disc space-y-2 pl-5">
          {r.changes.map((c, i) => (
            <li key={c.id ?? i}>{c.description}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

async function ReleaseNotesPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const products = await getSupportProducts(locale)
  const product = boundedQuery((await searchParams).urun)
  const selected = products.find((p) => p.slug === product)
  if (product === null || (product && !selected)) notFound()
  const releases = await getReleases(locale, selected?.id)
  // Grouped per product (releases arrive newest first): newest card open, older ones folded.
  const byProduct = new Map<string, { key: string; title: string; items: Release[] }>()
  for (const r of releases) {
    const p = relOf<Product>(r.product)
    const key = String(p?.id ?? 'x')
    const g = byProduct.get(key) ?? { key, title: p?.title ?? '', items: [] }
    g.items.push(r)
    byProduct.set(key, g)
  }
  const groups = [...byProduct.values()]
  return (
    <SupportFrame locale={locale} title={t('releases')} path="/destek/surum-notlari">
      <SupportFilters
        locale={locale}
        path="/destek/surum-notlari"
        products={products}
        product={product}
      />
      <div className="space-y-12">
        {groups.map((g) => {
          const [latest, ...older] = g.items
          return (
            <section key={g.key} aria-labelledby={`rel-${g.key}`} className="space-y-4">
              <h2 id={`rel-${g.key}`} className="text-h3 text-text">{g.title}</h2>
              <ReleaseCard release={latest} locale={locale} badge={t('latestRelease')} />
              {older.length ? (
                <details className="group rounded-lg border border-border bg-surface">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-6 py-3 text-small font-medium text-text [&::-webkit-details-marker]:hidden">
                    {t('olderReleases', { count: older.length })}
                    <ChevronDown aria-hidden className="size-4 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-4 border-t border-border p-4 sm:p-6">
                    {older.map((r) => <ReleaseCard key={r.id} release={r} locale={locale} compact />)}
                  </div>
                </details>
              ) : null}
            </section>
          )
        })}
      </div>
      {!releases.length ? <p>{t('empty')}</p> : null}
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><ReleaseNotesPage {...props} /></DynamicSecurity>
}
