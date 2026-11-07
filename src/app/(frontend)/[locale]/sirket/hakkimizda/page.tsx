import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { SetAlternates } from '@/components/layout/set-alternates'
import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { getPage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }
const SLUGS = ['hakkimizda', 'about']
const PATH = '/sirket/hakkimizda'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'about' }), getPage(locale, SLUGS)])
  return buildMetadata({ locale, path: PATH, ...seoText(page?.meta, page?.title || t('title'), t('lead')), image: mediaOf(page?.meta?.image)?.url })
}

export default async function AboutPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, n, page] = await Promise.all([
    getTranslations({ locale, namespace: 'about' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'nav' }),
    getPage(locale, SLUGS),
  ])
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
