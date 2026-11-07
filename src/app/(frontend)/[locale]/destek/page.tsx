import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { JsonLd } from '@/components/sections/json-ld'
import { Container } from '@/components/ui/container'
import { getSystemPage, mediaOf } from '@/lib/content'
import { breadcrumbJsonLd } from '@/lib/seo'
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
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'supportCenter' }), getSystemPage(locale, 'support')])
  return buildMetadata({ locale, path: '/destek', ...systemMeta(page, { title: t('title') }), image: mediaOf(page?.meta?.image)?.url })
}

export default async function SupportPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, products, page] = await Promise.all([
    getTranslations({ locale, namespace: 'supportCenter' }),
    getTranslations({ locale, namespace: 'common' }),
    getSupportProducts(locale),
    getSystemPage(locale, 'support'),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/destek' }]
  const links = [
    ['downloads', '/destek/indirmeler'],
    ['documentation', '/destek/dokumantasyon'],
    ['releases', '/destek/surum-notlari'],
    ['faq', '/destek/sss'],
    ['request', '/destek/talep'],
    ['contact', '/iletisim'],
  ] as const
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} page={page} fallback={{ title: t('title'), lead: t('lead') }} />
      <SystemBody locale={locale} page={page} listing={<Container>
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
      </Container>} />
    </>
  )
}
