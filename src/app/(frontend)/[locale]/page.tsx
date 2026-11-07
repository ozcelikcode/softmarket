import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

export const dynamic = 'error'

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { FallbackHome } from '@/components/home/fallback-home'
import { CmsPageContent } from '@/components/pages/cms-page'
import { JsonLd } from '@/components/sections/json-ld'
import { getContactSettings, getHomePage, mediaOf } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { absoluteUrl, buildMetadata, siteUrl } from '@/lib/seo'
import { publicContact, publicImage } from '@/lib/site'
import { publicText, safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string }> }

/*
 * Home (F6): the blocks of a published CMS page, resolved SiteSettings.homePage -> slug "home"; without one,
 * the built-in composition (FallbackHome) renders, so an empty database still has a home page.
 */

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }), getContactSettings(locale), getHomePage(locale),
  ])
  const name = publicText(settings?.siteName) ?? t('siteName')
  const tagline = publicText(settings?.tagline) ?? t('tagline')
  return buildMetadata({
    locale, path: '/',
    title: page?.meta?.title?.trim() || `${name} | ${tagline}`,
    description: page?.meta?.description?.trim() || tagline,
    image: mediaOf(page?.meta?.image)?.url ?? mediaOf(settings?.defaultOgImage)?.url,
  })
}

export default async function HomePage({ params }: Props) {
  const locale = await initLocale(params)
  const [c, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }), getContactSettings(locale), getHomePage(locale),
  ])

  const siteName = publicText(settings?.siteName) ?? c('siteName')
  const social = (settings?.social ?? []).map((s) => safeHref(s.url)).filter((u): u is string => Boolean(u))
  const logo = publicImage(settings?.logo)?.url
  const contact = publicContact(settings)

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: absoluteUrl('/', locale),
    ...(logo ? { logo: logo.startsWith('http') ? logo : `${siteUrl()}${logo}` } : {}),
    ...(social.length ? { sameAs: social } : {}),
    ...(contact.address ? { address: contact.address } : {}),
    ...(contact.email || contact.phone
      ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { telephone: contact.phone.label } : {}) }] }
      : {}),
  }

  return (
    <>
      <JsonLd data={organization} />
      {page ? <CmsPageContent page={page} locale={locale} crumbLabel={c('breadcrumb')} /> : <FallbackHome locale={locale} />}
    </>
  )
}
