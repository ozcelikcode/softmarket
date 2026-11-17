import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/yasal/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { RenderBlocks } from '@/components/blocks/render-blocks'
import { getCommerceState } from '@/lib/commerce/state'
import { isCommerceLegalPage } from '@/lib/payments/legal'
import { isEditingRender } from '@/lib/preview'
import { SetAlternates } from '@/components/layout/set-alternates'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { getPage, getSlugVariants, mediaOf } from '@/lib/content'
import { formatDate } from '@/lib/format'
import { fillLegalPlaceholders, readCompanyFacts } from '@/lib/company-facts'
import { isLegalDraft } from '@/lib/legal-draft'
import { getPayloadClient } from '@/lib/site'
import { cache } from 'react'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; slug: string }> }

/**
 * Sales legal pages (`pages.commerceLegal`; the P3 slug list only while the field is empty) exist only while
 * payments are open: otherwise 404 (no noindex page, no sitemap entry). Staff in draft mode may still preview
 * them before payments are switched on. Ordinary legal pages stay on the static/ISR path.
 */
async function assertVisible(page: { commerceLegal?: unknown; slug?: unknown }) {
  if (!isCommerceLegalPage(page)) return
  if ((await getCommerceState()).open) return
  if (await isEditingRender()) return
  notFound()
}

/** Company placeholders ([ŞİRKET UNVANI] …) are filled at render time from site-settings; the stored page is unchanged. */
const companyFacts = cache(async (locale: 'tr' | 'en') => readCompanyFacts(await getPayloadClient(), locale))
/** The visual editor/draft canvas keeps the stored tokens (editing must never save filled text back). */
const renderedLayout = async (layout: unknown, locale: string) =>
  (await isEditingRender()) ? layout : fillLegalPlaceholders(layout, await companyFacts(locale === 'en' ? 'en' : 'tr'))

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('pages', id)
  return Object.fromEntries(Object.entries(slugs).map(([l, s]) => [l, `/yasal/${enc(s!)}`]))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { slug } = await params
  const page = await getPage(locale, slug, { legalOnly: true })
  if (!page) notFound()
  await assertVisible(page)
  return buildMetadata({
    locale, path: `/yasal/${enc(slug)}`, ...seoText(page.meta, page.title), image: mediaOf(page.meta?.image)?.url,
    variants: await variantPaths(page.id), noindex: isLegalDraft(await renderedLayout(page.layout, locale)),
  })
}

export default async function LegalPage({ params }: Props) {
  const locale = await initLocale(params)
  const { slug } = await params
  const page = await getPage(locale, slug, { legalOnly: true })
  if (!page) notFound()
  await assertVisible(page)
  const [t, c, variants, layout] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getTranslations({ locale, namespace: 'common' }),
    variantPaths(page.id),
    renderedLayout(page.layout, locale),
  ])
  const trail = [{ label: c('home'), href: '/' }, { label: t('title'), href: `/yasal/${enc(slug)}` }, { label: page.title, href: `/yasal/${enc(slug)}` }]
  const date = formatDate(page.updatedAt, locale)
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <PageHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} eyebrow={t('title')} title={page.title} lead={date ? t('updated', { date }) : undefined} />
      <RenderBlocks blocks={layout as typeof page.layout} locale={locale} editing={await isEditingRender()} />
    </>
  )
}
