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
import type { Product } from '@/payload-types'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek/surum-notlari', title: t('releases') })
}

async function ReleaseNotesPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const products = await getSupportProducts(locale)
  const product = boundedQuery((await searchParams).urun)
  const selected = products.find((p) => p.slug === product)
  if (product === null || (product && !selected)) notFound()
  const releases = await getReleases(locale, selected?.id)
  return (
    <SupportFrame locale={locale} title={t('releases')} path="/destek/surum-notlari">
      <SupportFilters
        locale={locale}
        path="/destek/surum-notlari"
        products={products}
        product={product}
      />
      <div className="space-y-6">
        {releases.map((r) => (
          <article key={r.id} className="rounded-lg border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="font-mono text-h2 text-text">{r.version}</h2>
              <p className="text-small text-muted">
                {[relOf<Product>(r.product)?.title, formatDate(r.releaseDate, locale), r.channel].filter(Boolean).join(' · ')}
              </p>
            </div>
            {r.title ? <p className="mb-4 mt-2 text-h4 text-text">{r.title}</p> : <div className="mb-4" />}
            <RichContent locale={locale} data={r.notes} />
            {r.changes?.length ? (
              <ul className="mt-4 list-disc space-y-2 pl-5">
                {r.changes.map((c, i) => (
                  <li key={c.id ?? i}>{c.description}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
      {!releases.length ? <p>{t('empty')}</p> : null}
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><ReleaseNotesPage {...props} /></DynamicSecurity>
}
