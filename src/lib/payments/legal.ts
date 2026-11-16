/*
 * Sales ("commerce") legal pages (plan §5): distance sales agreement, pre-information form, refund/withdrawal.
 * Source of truth: `pages.commerceLegal` (select, one page per kind). The slug list below is only a backward-
 * compatible FALLBACK for pages that were published before the field existed (P3): it keeps such a page hidden
 * (404 / no sitemap / no footer link) while payments are closed. It never makes a page count as "ready": readiness
 * and `legalReady` use the field only. Visible only while the payments surface is open.
 */
export const COMMERCE_LEGAL_KINDS = ['distanceSales', 'preInformation', 'refund'] as const
export type CommerceLegalKind = (typeof COMMERCE_LEGAL_KINDS)[number]

export const isCommerceLegalKind = (value: unknown): value is CommerceLegalKind =>
  typeof value === 'string' && (COMMERCE_LEGAL_KINDS as readonly string[]).includes(value)

export const COMMERCE_LEGAL_SLUGS = {
  tr: ['mesafeli-satis-sozlesmesi', 'on-bilgilendirme-formu', 'iade-ve-cayma'],
  en: ['distance-sales-agreement', 'pre-information-form', 'refund-and-withdrawal'],
} as const

const ALL = new Set<string>([...COMMERCE_LEGAL_SLUGS.tr, ...COMMERCE_LEGAL_SLUGS.en])

/** A legal page is a sales page when its field says so; the slug list applies only while the field is empty. */
export function isCommerceLegalPage(page: { commerceLegal?: unknown; slug?: unknown } | null | undefined): boolean {
  if (!page) return false
  if (isCommerceLegalKind(page.commerceLegal)) return true
  return !page.commerceLegal && isCommerceLegalSlug(page.slug)
}

export type LegalFact = { kind: CommerceLegalKind | null; locale: 'tr' | 'en'; published: boolean; draft: boolean }

/**
 * Strict "three kinds published and not draft" check, per locale (the site is bilingual; a draft-bannered or
 * placeholder text in either language is not publishable). Pure and fail-closed: anything missing is not ready.
 */
export function evaluateLegal(facts: readonly LegalFact[]): { kinds: Record<CommerceLegalKind, boolean>; ready: boolean } {
  const ok = (kind: CommerceLegalKind, locale: 'tr' | 'en') =>
    facts.some((f) => f.kind === kind && f.locale === locale && f.published === true && f.draft === false)
  const kinds = Object.fromEntries(COMMERCE_LEGAL_KINDS.map((k) => [k, ok(k, 'tr') && ok(k, 'en')])) as Record<CommerceLegalKind, boolean>
  return { kinds, ready: COMMERCE_LEGAL_KINDS.every((k) => kinds[k]) }
}

export function isCommerceLegalSlug(slug: unknown): boolean {
  return typeof slug === 'string' && ALL.has(slug)
}

/** Local sales-legal target, normalized as a browser URL; absolute URLs must match `siteOrigin`. */
export function isCommerceLegalHref(href: unknown, siteOrigin?: string): boolean {
  return isCommerceLegalSlug(legalHrefTarget(href, siteOrigin)?.slug)
}

/** Local legal URL, including renamed pages. Explicit URL locale takes precedence over navigation locale. */
export function legalHrefTarget(href: unknown, siteOrigin?: string): { slug: string; locale?: 'tr' | 'en' } | null {
  if (typeof href !== 'string') return null
  try {
    const base = new URL(siteOrigin ?? 'https://softmarket.invalid')
    const local = href.startsWith('/') && !href.startsWith('//')
    if (!local && !siteOrigin) return null
    const url = new URL(href, base)
    if (url.origin !== base.origin) return null
    // Next normalizes repeated slashes; decode segments so encoded route names cannot skip the filter.
    const path = decodeURIComponent(url.pathname).replace(/\/+/g, '/')
    const match = /^(?:\/(tr|en))?\/(?:yasal|legal)\/([^/]+)\/?$/.exec(path)
    return match ? { slug: match[2]!, locale: match[1] as 'tr' | 'en' | undefined } : null
  } catch {
    return null
  }
}
