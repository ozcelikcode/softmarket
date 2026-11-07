import { CANONICAL_PATHS, SEGMENTS_EN } from '@/i18n/paths'

/*
 * F6 page model (pure: imported by the Payload config and the frontend).
 *
 * - System pages: a `pages` record with `systemKey` supplies the hero copy and the blocks of a fixed route.
 *   The route's own list is the movable `listing` block. Without a record the route keeps its i18n defaults.
 * - Landing pages: `[locale]/[slug]` renders standard/landing pages without a system key. Their slugs must
 *   not shadow a route segment in either locale (Next prefers static folders; next-intl rewrites EN paths).
 * - Templates (`pageType: template`) are never public: not routed, not in the sitemap, not readable anonymously.
 */

export const SYSTEM_PAGES = {
  products: '/urunler',
  solutions: '/cozumler',
  news: '/haberler',
  customers: '/referanslar',
  careers: '/kariyer',
  partners: '/is-ortaklari',
  support: '/destek',
  contact: '/iletisim',
  about: '/sirket/hakkimizda',
} as const satisfies Record<string, (typeof CANONICAL_PATHS)[number]>

export type SystemKey = keyof typeof SYSTEM_PAGES
export const SYSTEM_KEYS = Object.keys(SYSTEM_PAGES) as SystemKey[]
export const isSystemKey = (value: unknown): value is SystemKey =>
  typeof value === 'string' && Object.hasOwn(SYSTEM_PAGES, value)

export const PAGE_TYPES = ['standard', 'legal', 'landing', 'template'] as const
/** Page types served at `/[slug]` (when no system key is set). */
export const LANDING_PAGE_TYPES = ['standard', 'landing'] as const
export const HOME_SLUG = 'home'

/**
 * First URL segments a landing slug may not take: every route folder in TR and its EN translation, the
 * legacy `/arama` redirect, Payload/Next paths and file-like metadata routes. `home` stays allowed (it is
 * the home page fallback; `/home` redirects to `/`).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  ...CANONICAL_PATHS.map((p) => p.split('/')[1]).filter(Boolean),
  ...Object.keys(SEGMENTS_EN),
  ...Object.values(SEGMENTS_EN),
  'tr', 'en', 'admin', 'api', 'graphql', 'graphql-playground', 'next', '_next', 'media',
  'sitemap', 'sitemap-xml', 'robots', 'robots-txt', 'opengraph-image', 'twitter-image', 'icon', 'apple-icon',
  'favicon', 'manifest', 'preview', 'search', 'index',
])

export const isReservedSlug = (slug: unknown): boolean => typeof slug === 'string' && RESERVED_SLUGS.has(slug)

type PageLike = { slug?: unknown; pageType?: unknown; systemKey?: unknown }

/** Whether a page is served at `/[slug]`. */
export function isLandingPage(page: PageLike): boolean {
  return (
    !isSystemKey(page.systemKey) &&
    (LANDING_PAGE_TYPES as readonly string[]).includes(typeof page.pageType === 'string' ? page.pageType : 'standard') &&
    typeof page.slug === 'string' &&
    page.slug !== HOME_SLUG &&
    !isReservedSlug(page.slug)
  )
}

/** Canonical (TR) path of a page record, or null when it is not public at a URL of its own. */
export function pagePath(page: PageLike): string | null {
  if (typeof page.slug !== 'string' || !page.slug) return null
  if (page.pageType === 'template') return null
  if (page.pageType === 'legal') return `/yasal/${encodeURIComponent(page.slug)}`
  if (isSystemKey(page.systemKey)) return SYSTEM_PAGES[page.systemKey]
  if (page.slug === HOME_SLUG) return '/'
  // Pre-F6 about page convention.
  if (page.slug === 'hakkimizda' || page.slug === 'about') return '/sirket/hakkimizda'
  return isLandingPage(page) ? `/${encodeURIComponent(page.slug)}` : null
}
