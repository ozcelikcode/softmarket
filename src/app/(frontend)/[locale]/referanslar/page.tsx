import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { MediaCard } from '@/components/sections/media-card'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { Container } from '@/components/ui/container'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { getCaseStudies, getSystemPage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'customers' }), getSystemPage(locale, 'customers')])
  return buildMetadata({ locale, path: '/referanslar', ...systemMeta(page, { title: t('title'), lead: t('lead') }), image: mediaOf(page?.meta?.image)?.url })
}

export default async function CustomersPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, cases, page] = await Promise.all([
    getTranslations({ locale, namespace: 'customers' }),
    getTranslations({ locale, namespace: 'common' }),
    getCaseStudies(locale),
    getSystemPage(locale, 'customers'),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/referanslar' }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} page={page} fallback={{ title: t('title'), lead: t('lead') }} />
      <SystemBody locale={locale} page={page} listing={
        <Container>
          {cases.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {cases.map((cs, i) => (
                <div key={cs.id} {...anim(i % 3)} className="h-full">
                  <MediaCard
                    headingAs="h2"
                    href={`/referanslar/${encodeURIComponent(cs.slug!)}`} locale={locale} title={cs.title} description={cs.summary} meta={cs.customerName}
                    logo={mediaOf(cs.customerLogo) ? <MediaImage media={cs.customerLogo} className="max-h-12 w-auto object-contain" /> : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      } />
    </>
  )
}
