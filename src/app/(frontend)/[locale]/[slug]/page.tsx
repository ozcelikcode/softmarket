import { contentStaticParams } from '@/lib/static-params'

export const revalidate = 3600
export async function generateStaticParams({ params }: { params: Record<string, string> }) {
  return contentStaticParams('/[slug]', params)
}

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound, permanentRedirect } from 'next/navigation'

import { SetAlternates } from '@/components/layout/set-alternates'
import { CmsPageContent } from '@/components/pages/cms-page'
import { JsonLd } from '@/components/sections/json-ld'
import { localizedHref } from '@/i18n/paths'
import type { Locale } from '@/i18n/routing'
import { getHomePageId, getLandingPage, getSlugVariants, mediaOf } from '@/lib/content'
import { alternateHrefs, enc, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata, seoText } from '@/lib/seo'
import { HOME_SLUG, isLandingPage } from '@/lib/system-pages'

/*
 * Landing pages (F6): `pages` of type standard/landing without a system key, at `/<slug>` in both locales.
 * Static route folders always win (Next prefers them; EN paths are rewritten before routing), reserved
 * slugs are rejected at save time and again here, templates are never readable anonymously.
 */

type Props = { params: Promise<{ locale: string; slug: string }> }

const variantPaths = async (id: number) => {
  const slugs = await getSlugVariants('pages', id)
  const out: Partial<Record<Locale, string>> = {}
  for (const [l, s] of Object.entries(slugs) as [Locale, string][]) {
    if (isLandingPage({ slug: s, pageType: 'landing' })) out[l] = `/${enc(s)}`
  }
  return out
}

async function resolve(params: Props['params']) {
  const locale = await initLocale(params)
  const { slug } = await params
  // The home page has one URL: `/home` (or the configured home page's own slug) redirects to `/`.
  if (slug === HOME_SLUG) permanentRedirect(localizedHref('/', locale))
  const page = await getLandingPage(locale, slug)
  if (!page) notFound()
  if (page.id === (await getHomePageId())) permanentRedirect(localizedHref('/', locale))
  return { locale, slug, page }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, page } = await resolve(params)
  return buildMetadata({
    locale, path: `/${enc(slug)}`, ...seoText(page.meta, page.title), image: mediaOf(page.meta?.image)?.url,
    variants: await variantPaths(page.id),
  })
}

export default async function LandingPage({ params }: Props) {
  const { locale, slug, page } = await resolve(params)
  const [c, variants] = await Promise.all([getTranslations({ locale, namespace: 'common' }), variantPaths(page.id)])
  const trail = [{ label: c('home'), href: '/' }, { label: page.title, href: `/${enc(slug)}` }]
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SetAlternates hrefs={alternateHrefs(variants)} />
      <CmsPageContent page={page} locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} />
    </>
  )
}
