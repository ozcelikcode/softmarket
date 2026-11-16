/*
 * Sales ("commerce") legal pages (plan §5): distance sales agreement, pre-information form, refund/withdrawal.
 * Schemaless P3 marker: a slug list (the plan's `pages.commerceLegal` select needs a schema change and is left
 * to a user decision). Slugs follow the legal Markdown file names (TR file name = slug; EN names per P7).
 * Visible only while the payments surface is open; otherwise 404, no sitemap entry, no footer/header link.
 */
export const COMMERCE_LEGAL_SLUGS = {
  tr: ['mesafeli-satis-sozlesmesi', 'on-bilgilendirme-formu', 'iade-ve-cayma'],
  en: ['distance-sales-agreement', 'pre-information-form', 'refund-and-withdrawal'],
} as const

const ALL = new Set<string>([...COMMERCE_LEGAL_SLUGS.tr, ...COMMERCE_LEGAL_SLUGS.en])

export function isCommerceLegalSlug(slug: unknown): boolean {
  return typeof slug === 'string' && ALL.has(slug)
}

/** Local sales-legal target, normalized as a browser URL; absolute URLs must match `siteOrigin`. */
export function isCommerceLegalHref(href: unknown, siteOrigin?: string): boolean {
  if (typeof href !== 'string') return false
  try {
    const base = new URL(siteOrigin ?? 'https://softmarket.invalid')
    const local = href.startsWith('/') && !href.startsWith('//')
    if (!local && !siteOrigin) return false
    const url = new URL(href, base)
    if (url.origin !== base.origin) return false
    // Next normalizes repeated slashes; decode segments so encoded route names cannot skip the filter.
    const path = decodeURIComponent(url.pathname).replace(/\/+/g, '/')
    const match = /^(?:\/(?:tr|en))?\/(?:yasal|legal)\/([^/]+)\/?$/.exec(path)
    return Boolean(match && isCommerceLegalSlug(match[1]))
  } catch {
    return false
  }
}
