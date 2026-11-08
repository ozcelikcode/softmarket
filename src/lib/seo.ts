import type { Metadata } from 'next'

import { localizedHref } from '@/i18n/paths'
import { routing, type Locale } from '@/i18n/routing'

export { serverUrl as siteUrl } from './server-url'
import { serverUrl as siteUrl } from './server-url'

/** Absolute public URL for a canonical (Turkish) path rendered in `locale`. */
export const absoluteUrl = (path: string, locale: Locale): string => {
  const href = localizedHref(path, locale)
  return /^https?:/i.test(href) ? href : `${siteUrl()}${href === '#' ? '' : href}`
}

export type PageMetaInput = {
  locale: Locale
  /** Canonical (Turkish-form) path of this page in the current locale, e.g. `/haberler/slug`. */
  path: string
  title?: string | null
  description?: string | null
  image?: string | null
  /** Per-locale canonical-form paths when slugs differ. Omitted locales are left out of hreflang. */
  variants?: Partial<Record<Locale, string>>
  type?: 'website' | 'article'
  noindex?: boolean
}

/** Metadata with canonical, hreflang alternates and Open Graph. `title`/`description` are plain text. */
export function buildMetadata(input: PageMetaInput): Metadata {
  const { locale, path, title, description, image, type = 'website' } = input
  const variants = input.variants ?? Object.fromEntries(routing.locales.map((l) => [l, path]))
  const languages: Record<string, string> = {}
  for (const l of routing.locales) if (variants[l]) languages[l] = absoluteUrl(variants[l]!, l)
  const canonical = absoluteUrl(path, locale)
  if (variants[routing.defaultLocale]) languages['x-default'] = languages[routing.defaultLocale]
  const imageUrl = image || `/${locale}/opengraph-image`
  const img = [{ url: imageUrl.startsWith('http') ? imageUrl : `${siteUrl()}${imageUrl}` }]
  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    alternates: { canonical, languages },
    robots: input.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type, url: canonical, locale, ...(title ? { title } : {}), ...(description ? { description } : {}), images: img,
    },
    twitter: { card: img ? 'summary_large_image' : 'summary', ...(title ? { title } : {}), ...(description ? { description } : {}), images: img?.map((i) => i.url) },
  }
}

/** Plugin-seo `meta` group with explicit fallbacks. */
export function seoText(
  meta: { title?: string | null; description?: string | null } | null | undefined,
  fallbackTitle: string,
  fallbackDescription?: string | null,
) {
  return {
    title: meta?.title?.trim() || fallbackTitle,
    description: meta?.description?.trim() || fallbackDescription?.trim() || undefined,
  }
}

/** Safe JSON for a `<script type="application/ld+json">` body. */
export { jsonLdString } from './json-ld-string'

/** BreadcrumbList JSON-LD. Every crumb needs a canonical-form href. */
export function breadcrumbJsonLd(locale: Locale, crumbs: { label: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.label, item: absoluteUrl(c.href, locale),
    })),
  }
}
