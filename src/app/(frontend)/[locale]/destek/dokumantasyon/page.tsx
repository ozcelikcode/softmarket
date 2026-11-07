import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupportFrame } from '@/components/sections/support-frame'
import { AppLink } from '@/components/ui/app-link'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportFilters } from '@/components/sections/support-filters'
import { getSupportProducts } from '@/lib/support'
import { boundedQuery } from '@/lib/support-query'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek/dokumantasyon', title: t('documentation') })
}

async function DocumentationPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const products = await getSupportProducts(locale)
  const product = boundedQuery((await searchParams).urun)
  if (product === null || (product && !products.some((p) => p.slug === product))) notFound()
  const filtered = products.filter((p) => !product || p.slug === product)
  return (
    <SupportFrame locale={locale} title={t('documentation')} path="/destek/dokumantasyon">
      <SupportFilters
        locale={locale}
        path="/destek/dokumantasyon"
        products={products}
        product={product}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <AppLink
            key={p.id}
            href={`/destek/dokumantasyon/${encodeURIComponent(p.slug!)}`}
            locale={locale}
            className="rounded-lg border border-border bg-surface p-6 text-h4 hover:border-accent"
          >
            {p.title} →
          </AppLink>
        ))}
      </div>
      {!filtered.length ? <p>{t('empty')}</p> : null}
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><DocumentationPage {...props} /></DynamicSecurity>
}
