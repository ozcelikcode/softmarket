import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { SetAlternates } from '@/components/layout/set-alternates'
import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { getPage, getSystemPage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }
const SLUGS = ['hakkimizda', 'about']
const PATH = '/sirket/hakkimizda'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, system, page] = await Promise.all([getTranslations({ locale, namespace: 'about' }), getSystemPage(locale, 'about'), getPage(locale, SLUGS)])
  if (system) return buildMetadata({ locale, path: PATH, ...systemMeta(system, { title: t('title'), lead: t('lead') }), image: mediaOf(system.meta?.image)?.url })
  return buildMetadata({ locale, path: PATH, ...seoText(page?.meta, page?.title || t('title'), t('lead')), image: mediaOf(page?.meta?.image)?.url })
}

export default async function AboutPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, n, system, page] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'nav' }),
    getSystemPage(locale, 'about'),
    getPage(locale, SLUGS),
  ])
  if (system) {
    // F6 system page: CMS hero + blocks; an empty layout keeps the "content coming" state.
    const crumbs = [{ label: c('home'), href: '/' }, { label: c('company'), href: PATH }, { label: t('title'), href: PATH }]
    return (
      <>
        <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
        <SetAlternates hrefs={{ tr: '/tr/sirket/hakkimizda', en: '/en/company/about' }} />
        <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={crumbs} page={system} fallback={{ title: t('title'), lead: t('lead'), eyebrow: n('company') }} />
        {system.layout?.length ? <SystemBody locale={locale} page={system} /> : (
          <Section theme="light" spacing="md"><Container><EmptyState title={t('emptyTitle')} description={t('emptyDesc')} /></Container></Section>
        )}
      </>
    )
  }
  const trail = [{ label: c('home'), href: '/' }, { label: c('company'), href: PATH }, { label: page?.title || t('title'), href: PATH }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={{ tr: '/tr/sirket/hakkimizda', en: '/en/company/about' }} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={n('company')} title={page?.title || t('title')} lead={page ? undefined : t('lead')} />
      {page?.layout?.length ? (
        <RenderBlocks blocks={page.layout} locale={locale} />
      ) : (
        <Section theme="light" spacing="md"><Container><EmptyState title={t('emptyTitle')} description={t('emptyDesc')} /></Container></Section>
      )}
    </>
  )
}
