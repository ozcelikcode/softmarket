import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { MediaCard } from '@/components/sections/media-card'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { MediaImage } from '@/components/ui/media-image'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import { getCaseStudies, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'customers' })
  return buildMetadata({ locale, path: '/referanslar', title: t('title'), description: t('lead') })
}

export default async function CustomersPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, cases] = await Promise.all([
    getTranslations({ locale, namespace: 'customers' }),
    getTranslations({ locale, namespace: 'common' }),
    getCaseStudies(locale),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: '/referanslar' }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} title={t('title')} lead={t('lead')} />
      <Section theme="light" spacing="md">
        <Container>
          {cases.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {cases.map((cs, i) => (
                <Reveal key={cs.id} delay={(i % 3) * 0.05} className="h-full">
                  <MediaCard
                    headingAs="h2"
                    href={`/referanslar/${encodeURIComponent(cs.slug!)}`} locale={locale} title={cs.title} description={cs.summary} meta={cs.customerName}
                    logo={mediaOf(cs.customerLogo) ? <MediaImage media={cs.customerLogo} className="max-h-12 w-auto object-contain" /> : undefined}
                  />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      </Section>
    </>
  )
}
