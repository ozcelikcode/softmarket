import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SupportFrame } from '@/components/sections/support-frame'
import { AppLink } from '@/components/ui/app-link'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportSearch } from '@/components/sections/support-search'
import { SupportFilters } from '@/components/sections/support-filters'
import { getSupportProducts } from '@/lib/support'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek', title: t('title') })
}

export default async function SupportPage({ params }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const products = await getSupportProducts(locale)
  const links = [
    ['downloads', '/destek/indirmeler'],
    ['documentation', '/destek/dokumantasyon'],
    ['releases', '/destek/surum-notlari'],
    ['faq', '/destek/sss'],
    ['request', '/destek/talep'],
    ['contact', '/iletisim'],
  ] as const
  return (
    <SupportFrame locale={locale} path="/destek" title={t('title')} lead={t('lead')}>
      <SupportSearch locale={locale} />
      <SupportFilters locale={locale} path="/destek/dokumantasyon" products={products} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links.map(([key, href]) => (
          <AppLink
            key={key}
            locale={locale}
            href={href}
            className="rounded-lg border border-border bg-surface p-6 text-h4 hover:border-accent"
          >
            {t(key)} →
          </AppLink>
        ))}
      </div>
    </SupportFrame>
  )
}
