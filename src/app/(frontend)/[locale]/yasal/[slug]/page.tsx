import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/yasal/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { getPage, getSlugVariants, mediaOf } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('pages', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/yasal/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const page = await getPage(locale, slug, { legalOnly: true })
  if (!page) notFound()
  return buildMetadata({
    locale, path: `/yasal/${enc(slug)}`, ...seoText(page.meta, page.title), image: mediaOf(page.meta?.image)?.url,
    variants: await variantPaths(page.id),
  })
}

export default async function LegalPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const page = await getPage(locale, slug, { legalOnly: true })
  if (!page) notFound()
  const [t, c, variants] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getTranslations({ locale, namespace: 'common' }),
    variantPaths(page.id),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: `/yasal/${enc(slug)}` }, { label: page.title, href: `/yasal/${enc(slug)}` }]
  const date = formatDate(page.updatedAt, locale)
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={t('title')} title={page.title} lead={date ? t('updated', { date }) : undefined} />
      <RenderBlocks blocks={page.layout} locale={locale} />
    </>
  )
}
