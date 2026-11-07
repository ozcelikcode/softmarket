import { cache } from 'react'
import type { Where } from 'payload'

import type { Locale } from '@/i18n/routing'
import { routing } from '@/i18n/routing'
import { readAs } from '@/lib/preview'
import { getPayloadClient, safe } from '@/lib/site'
import { HOME_SLUG, isLandingPage, isReservedSlug, LANDING_PAGE_TYPES, type SystemKey } from '@/lib/system-pages'
import { safeHref } from '@/lib/utils'
import type {
  CaseStudy, Career, Doc, Download, Edition, Media, Page, Partner, Post, Product, ProductFamily, Solution,
} from '@/payload-types'

/*
 * Anonymous, published-only reads for public pages. Same pattern as lib/site.ts:
 * overrideAccess:false + user:null + draft:false, field selection, bounded depth,
 * and every call degrades to an empty value instead of throwing.
 * F8: single-document loaders (pages, families, products, solutions, case studies, posts) use `readAs()`:
 * a re-validated staff session in Next draft mode reads drafts (`draft: true`, staff user, access on);
 * everyone else gets the anonymous published read. Listing/related queries stay anonymous.
 */

export const anon = (locale: Locale) => ({
  locale, overrideAccess: false as const, user: null, draft: false as const,
})

// `filename` is required for Payload to compute `url`.
const mediaPick = { url: true, filename: true, alt: true, width: true, height: true, mimeType: true, protected: true, visibility: true } as const
const familyPick = { title: true, slug: true, tagline: true } as const

export const populate = {
  media: mediaPick,
  'product-families': familyPick,
  products: { title: true, slug: true, tagline: true, summary: true, family: true, heroImage: true },
  'case-studies': { title: true, slug: true, customerName: true, customerLogo: true, summary: true },
  partners: { name: true, logo: true, website: true, tier: true },
  faqs: { question: true, answer: true },
  pages: { slug: true, pageType: true, systemKey: true },
  solutions: { slug: true },
  industries: { slug: true, title: true },
  posts: { slug: true },
  careers: { slug: true },
  docs: { slug: true, product: true },
} as const

const bySlug = (slug: string): Where => ({ slug: { equals: slug } })

/** Media relation that was populated and is readable (otherwise it stays an ID). */
export function mediaOf(value: unknown): Pick<Media, 'url' | 'alt' | 'width' | 'height' | 'mimeType' | 'protected' | 'visibility'> | null {
  if (!value || typeof value !== 'object') return null
  const m = value as Media
  return typeof m.url === 'string' && safeHref(m.url) && /^(?:https?:\/\/|\/)/i.test(m.url) ? m : null
}

export function relOf<T extends object>(value: unknown): T | null {
  return value && typeof value === 'object' ? (value as T) : null
}

export type CatalogProduct = Pick<Product, 'id' | 'title' | 'slug' | 'tagline' | 'summary' | 'heroImage' | 'family' | 'featured'>

/* ------------------------------------------------------------------ products */

export const getFamilies = cache((locale: Locale, limit = 24) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'product-families', ...anon(locale), limit, depth: 1, sort: 'sortOrder',
    select: { title: true, slug: true, tagline: true, icon: true, image: true },
    populate,
  }).then((r) => r.docs.filter((d) => d.slug) as ProductFamily[]), [] as ProductFamily[]))

/** Count only public products, without populating their relationships. */
export const getProductFamilyCounts = cache((locale: Locale) =>
  safe(async () => {
    const result = await (await getPayloadClient()).find({
      collection: 'products', ...anon(locale), pagination: false, limit: 0, depth: 0,
      select: { family: true, slug: true },
    })
    const counts = new Map<number, number>()
    for (const product of result.docs) {
      if (!product.slug) continue
      const id = typeof product.family === 'object' ? product.family?.id : product.family
      if (typeof id !== 'number') continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, new Map<number, number>()))

const getCatalogProductsCached = cache((locale: Locale, familyId: number | undefined, featured: boolean, limit: number) =>
  safe(async () => {
    const and: Where[] = []
    if (familyId) and.push({ family: { equals: familyId } })
    if (featured) and.push({ featured: { equals: true } })
    return (await getPayloadClient()).find({
      collection: 'products', ...anon(locale), limit, depth: 2, sort: 'sortOrder',
      where: and.length ? { and } : undefined,
      select: { title: true, slug: true, tagline: true, summary: true, heroImage: true, family: true, featured: true },
      populate,
    }).then((r) => r.docs.filter((d) => d.slug && relOf<ProductFamily>(d.family)?.slug) as CatalogProduct[])
  }, [] as CatalogProduct[]))

export const getCatalogProducts = (locale: Locale, opts: { familyId?: number; featured?: boolean; limit?: number } = {}) =>
  getCatalogProductsCached(locale, opts.familyId, Boolean(opts.featured), opts.limit ?? 100)

export const getFamily = cache((locale: Locale, slug: string) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'product-families', ...(await readAs(locale)), limit: 1, depth: 2, where: bySlug(slug),
    select: { title: true, slug: true, tagline: true, description: true, icon: true, image: true, meta: true, layout: true },
    populate,
  }).then((r) => (r.docs[0] as ProductFamily | undefined) ?? null), null))

export const getProductDetail = cache(async (locale: Locale, familySlug: string, productSlug: string) => {
  return safe(async () => {
    const payload = await getPayloadClient()
    const family = await getFamily(locale, familySlug)
    if (!family) return null
    const found = await payload.find({
      collection: 'products', ...(await readAs(locale)), limit: 1, depth: 2,
      where: { and: [bySlug(productSlug), { family: { equals: family.id } }] },
      select: {
        title: true, slug: true, tagline: true, summary: true, heroImage: true, layout: true, features: true,
        specs: true, systemRequirements: true, gallery: true, brochure: true, meta: true, family: true,
      },
      populate,
    })
    const product = found.docs[0] as Product | undefined
    if (!product) return null
    const [editions, downloads, doc] = await Promise.all([
      payload.find({
        collection: 'editions', ...anon(locale), limit: 20, depth: 0, sort: 'sortOrder',
        where: { product: { equals: product.id } },
        select: {
          title: true, sku: true, description: true, highlights: true,
          licenseType: true, durationMonths: true, seats: true, sortOrder: true,
        },
      }).then((r) => r.docs as Edition[]).catch(() => [] as Edition[]),
      // Anonymous access returns only public downloads; licensed ones never reach this page.
      payload.find({
        collection: 'downloads', ...anon(locale), limit: 20, depth: 1,
        where: { and: [{ product: { equals: product.id } }, { access: { equals: 'public' } }] },
        select: { title: true, description: true, file: true, os: true, arch: true, access: true, checksumSha256: true },
        populate: { media: { url: true, filename: true, filesize: true } },
      }).then((r) => r.docs as Download[]).catch(() => [] as Download[]),
      payload.find({
        collection: 'docs', ...anon(locale), limit: 1, depth: 0, sort: 'sortOrder',
        where: { product: { equals: product.id } },
        select: { slug: true },
      }).then((r) => (r.docs[0] as Pick<Doc, 'slug'> | undefined)?.slug ?? null).catch(() => null),
    ])
    return { family, product, editions, downloads, docSlug: doc }
  }, null)
})

/* ----------------------------------------------------------------- solutions */

export const getSolutions = cache((locale: Locale, limit = 24) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'solutions', ...anon(locale), limit, depth: 1, sort: 'sortOrder',
    select: { title: true, slug: true, summary: true, heroImage: true, industries: true },
    populate,
  }).then((r) => r.docs.filter((d) => d.slug) as Solution[]), [] as Solution[]))

export const getSolution = cache((locale: Locale, slug: string) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'solutions', ...(await readAs(locale)), limit: 1, depth: 2, where: bySlug(slug),
    select: {
      title: true, slug: true, summary: true, heroImage: true, layout: true, industries: true,
      products: true, caseStudies: true, meta: true,
    },
    populate,
  }).then((r) => (r.docs[0] as Solution | undefined) ?? null), null))

/* ------------------------------------------------------------------ company */

const getCaseStudiesCached = cache((locale: Locale, limit: number, featured: boolean) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'case-studies', ...anon(locale), limit, depth: 1, sort: '-publishedAt',
    where: featured ? { featured: { equals: true } } : undefined,
    select: { title: true, slug: true, customerName: true, customerLogo: true, summary: true, results: true, featured: true, publishedAt: true },
    populate,
  }).then((r) => r.docs.filter((d) => d.slug) as CaseStudy[]), [] as CaseStudy[]))

export const getCaseStudies = (locale: Locale, opts: { limit?: number; featured?: boolean } = {}) =>
  getCaseStudiesCached(locale, opts.limit ?? 24, Boolean(opts.featured))

export const getCaseStudy = cache((locale: Locale, slug: string) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'case-studies', ...(await readAs(locale)), limit: 1, depth: 2, where: bySlug(slug),
    select: {
      title: true, slug: true, customerName: true, customerLogo: true, summary: true, challenge: true,
      solution: true, results: true, testimonial: true, layout: true, industry: true, products: true,
      meta: true, publishedAt: true,
    },
    populate,
  }).then((r) => (r.docs[0] as CaseStudy | undefined) ?? null), null))

export const POSTS_PER_PAGE = 9

const getPostsCached = cache((locale: Locale, limit: number, page: number) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'posts', ...anon(locale), limit, page, depth: 1,
    sort: '-publishedAt',
    select: { title: true, slug: true, excerpt: true, coverImage: true, category: true, publishedAt: true },
    populate,
  }).then((r) => ({ docs: r.docs.filter((d) => d.slug) as Post[], totalPages: r.totalPages })),
  { docs: [] as Post[], totalPages: 0 }))

export const getPosts = (locale: Locale, opts: { limit?: number; page?: number } = {}) =>
  getPostsCached(locale, opts.limit ?? POSTS_PER_PAGE, opts.page ?? 1)

export const getPost = cache((locale: Locale, slug: string) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'posts', ...(await readAs(locale)), limit: 1, depth: 2, where: bySlug(slug),
    select: {
      title: true, slug: true, excerpt: true, coverImage: true, content: true, category: true,
      products: true, meta: true, publishedAt: true, updatedAt: true,
    },
    populate,
  }).then((r) => (r.docs[0] as Post | undefined) ?? null), null))

export const getCareers = cache((locale: Locale) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'careers', ...anon(locale), limit: 50, depth: 0, sort: '-publishedAt',
    select: { title: true, slug: true, department: true, location: true, employmentType: true, workMode: true, summary: true },
  }).then((r) => r.docs.filter((d) => d.slug) as Career[]), [] as Career[]))

export const getCareer = cache((locale: Locale, slug: string) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'careers', ...anon(locale), limit: 1, depth: 0, where: bySlug(slug),
    select: {
      title: true, slug: true, department: true, location: true, employmentType: true, workMode: true,
      summary: true, description: true, meta: true, publishedAt: true,
    },
  }).then((r) => (r.docs[0] as Career | undefined) ?? null), null))

export const getPartners = cache((locale: Locale, limit = 100) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'partners', ...anon(locale), limit, depth: 1, sort: 'sortOrder',
    select: { name: true, logo: true, website: true, tier: true, country: true, city: true, description: true },
    populate,
  }).then((r) => r.docs as Partner[]), [] as Partner[]))

const getPageCached = cache((locale: Locale, serializedSlugs: string, legalOnly: boolean) =>
  safe(async () => {
    const list: string[] = JSON.parse(serializedSlugs)
    const and: Where[] = [{ slug: { in: list } }]
    if (legalOnly) and.push({ pageType: { equals: 'legal' } })
    return (await getPayloadClient()).find({
      collection: 'pages', ...(await readAs(locale)), limit: 1, depth: 2, where: { and },
      select: { title: true, slug: true, layout: true, meta: true, pageType: true, updatedAt: true },
      populate,
    }).then((r) => (r.docs[0] as Page | undefined) ?? null)
  }, null))

export const getPage = (locale: Locale, slugs: string | string[], opts: { legalOnly?: boolean } = {}) =>
  getPageCached(locale, JSON.stringify(Array.isArray(slugs) ? slugs : [slugs]), Boolean(opts.legalOnly))

/* -------------------------------------------------------------- CMS pages (F6) */

const pageSelect = {
  title: true, slug: true, layout: true, hero: true, meta: true, pageType: true, systemKey: true, updatedAt: true,
} as const
export type CmsPage = Pick<Page, 'id' | 'title' | 'slug' | 'layout' | 'hero' | 'meta' | 'pageType' | 'systemKey' | 'updatedAt'>

/** SiteSettings.homePage as an ID (no population: the page is read below with anonymous access). */
export const getHomePageId = cache(() =>
  safe(async () => {
    const settings = await (await getPayloadClient()).findGlobal({
      slug: 'site-settings', depth: 0, overrideAccess: false, user: null, draft: false, select: { homePage: true },
    })
    const ref = (settings as { homePage?: unknown }).homePage
    const id = ref && typeof ref === 'object' ? (ref as { id?: unknown }).id : ref
    return typeof id === 'number' ? id : null
  }, null))

/** Pages that can be a home page: not legal, not a template, no system key. */
const homeCandidate: Where = {
  and: [
    { or: [{ pageType: { not_in: ['legal', 'template'] } }, { pageType: { exists: false } }] },
    { systemKey: { exists: false } },
  ],
}

/**
 * Home resolution order: SiteSettings.homePage -> page with slug `home` -> null (built-in fallback home).
 * Both candidates come from one anonymous, published-only query; an unpublished/draft home page is skipped.
 */
export const getHomePage = cache((locale: Locale) =>
  safe(async () => {
    const id = await getHomePageId()
    const found = await (await getPayloadClient()).find({
      collection: 'pages', ...(await readAs(locale)), limit: 2, depth: 2, pagination: false,
      where: { and: [homeCandidate, { or: [...(id ? [{ id: { equals: id } }] : []), { slug: { equals: HOME_SLUG } }] }] },
      select: pageSelect, populate,
    })
    const docs = found.docs as CmsPage[]
    return (id ? docs.find((d) => d.id === id) : undefined) ?? docs.find((d) => d.slug === HOME_SLUG) ?? null
  }, null))

/** The page bound to a fixed route (pages.systemKey), published only. */
export const getSystemPage = cache((locale: Locale, key: SystemKey) =>
  safe(async () => (await getPayloadClient()).find({
    collection: 'pages', ...(await readAs(locale)), limit: 1, depth: 2,
    where: { and: [{ systemKey: { equals: key } }, { pageType: { not_equals: 'template' } }] },
    select: pageSelect, populate,
  }).then((r) => (r.docs[0] as CmsPage | undefined) ?? null), null))

/** Landing page served at `/[slug]`: standard/landing type, no system key, not reserved, not the home slug. */
export const getLandingPage = cache((locale: Locale, slug: string) =>
  safe(async () => {
    if (!slug || slug === HOME_SLUG || isReservedSlug(slug)) return null
    const page = await (await getPayloadClient()).find({
      collection: 'pages', ...(await readAs(locale)), limit: 1, depth: 2,
      where: { and: [
        { slug: { equals: slug } },
        { or: [{ pageType: { in: [...LANDING_PAGE_TYPES] } }, { pageType: { exists: false } }] },
        { systemKey: { exists: false } },
      ] },
      select: pageSelect, populate,
    }).then((r) => (r.docs[0] as CmsPage | undefined) ?? null)
    return page && isLandingPage(page) ? page : null
  }, null))

/** Public company/contact settings (explicit field selection: no tax or KEP data). */
export const getContactSettings = cache((locale: Locale) =>
  safe(async () => (await getPayloadClient()).findGlobal({
    slug: 'site-settings', locale, depth: 1, overrideAccess: false, user: null, draft: false,
    select: {
      siteName: true, tagline: true, logo: true, defaultOgImage: true,
      company: { legalName: true }, contact: true, social: true,
    },
    populate: { media: mediaPick },
  }), null))

/* ----------------------------------------------------------- locale variants */

type SlugMap = Partial<Record<Locale, string>>
const pickLocales = (raw: unknown): SlugMap => {
  const out: SlugMap = {}
  if (raw && typeof raw === 'object') {
    for (const l of routing.locales) {
      const v = (raw as Record<string, unknown>)[l]
      if (typeof v === 'string' && v) out[l] = v
    }
  }
  return out
}

/** Slug per locale (no fallback) for hreflang and the language switcher. */
export const getSlugVariants = cache((
  collection: 'product-families' | 'solutions' | 'case-studies' | 'posts' | 'careers' | 'pages',
  id: number,
) =>
  safe(async () => {
    const doc = await (await getPayloadClient()).findByID({
      collection, id, locale: 'all', fallbackLocale: false, overrideAccess: false, user: null, draft: false,
      depth: 0, select: { slug: true },
    })
    return pickLocales((doc as { slug?: unknown }).slug)
  }, {} as SlugMap))

export const getProductVariants = cache((id: number) =>
  safe(async () => {
    const doc = await (await getPayloadClient()).findByID({
      collection: 'products', id, locale: 'all', fallbackLocale: false, overrideAccess: false, user: null,
      draft: false, depth: 1, select: { slug: true, family: true }, populate: { 'product-families': { slug: true } },
    })
    const product = pickLocales((doc as { slug?: unknown }).slug)
    const family = pickLocales(relOf<{ slug?: unknown }>((doc as { family?: unknown }).family)?.slug)
    const out: Partial<Record<Locale, string[]>> = {}
    for (const l of routing.locales) if (product[l] && family[l]) out[l] = [family[l]!, product[l]!]
    return out
  }, {} as Partial<Record<Locale, string[]>>))

/* ------------------------------------------------------------------- sitemap */

export type SitemapEntry = { paths: Partial<Record<Locale, string>>; lastModified?: string }

/** Every published URL, with the per-locale slug (docs missing a slug in a locale are skipped there). */
export const getSitemapEntries = cache(() =>
  safe(async () => {
    const payload = await getPayloadClient()
    const base = { locale: 'all' as const, fallbackLocale: false as const, overrideAccess: false as const, user: null, draft: false as const, limit: 1000, pagination: false as const }
    const list = (collection: 'product-families' | 'products' | 'solutions' | 'case-studies' | 'posts' | 'careers' | 'pages', where?: Where) =>
      payload.find({
        collection, ...base, depth: collection === 'products' ? 1 : 0, where,
        select: collection === 'products'
          ? { slug: true, family: true, updatedAt: true }
          : collection === 'pages' ? { slug: true, pageType: true, systemKey: true, updatedAt: true } : { slug: true, updatedAt: true },
        populate: { 'product-families': { slug: true } },
      }).then((r) => r.docs as unknown as { id: number; slug?: unknown; family?: unknown; pageType?: string | null; systemKey?: string | null; updatedAt?: string }[])
        .catch(() => [])
    const [families, products, solutions, cases, posts, careers, pages, homePageId] = await Promise.all([
      list('product-families'), list('products'), list('solutions'), list('case-studies'), list('posts'),
      list('careers'), list('pages', { pageType: { in: ['legal', ...LANDING_PAGE_TYPES] } }), getHomePageId(),
    ])
    const entries: SitemapEntry[] = []
    const simple = (docs: typeof families, prefix: string) => {
      for (const d of docs) {
        const slugs = pickLocales(d.slug)
        const paths: SitemapEntry['paths'] = {}
        for (const l of routing.locales) if (slugs[l]) paths[l] = `${prefix}/${encodeURIComponent(slugs[l]!)}`
        if (Object.keys(paths).length) entries.push({ paths, lastModified: d.updatedAt })
      }
    }
    simple(families, '/urunler')
    simple(solutions, '/cozumler')
    simple(cases, '/referanslar')
    simple(posts, '/haberler')
    simple(careers, '/kariyer')
    simple(pages.filter((p) => p.pageType === 'legal'), '/yasal')
    // Landing pages (`/[slug]`): templates, system pages, the home slug and reserved slugs never get a URL.
    for (const d of pages) {
      if (d.pageType === 'legal' || d.id === homePageId) continue
      const slugs = pickLocales(d.slug)
      const paths: SitemapEntry['paths'] = {}
      for (const l of routing.locales) {
        if (slugs[l] && isLandingPage({ slug: slugs[l], pageType: d.pageType ?? 'standard', systemKey: d.systemKey })) paths[l] = `/${encodeURIComponent(slugs[l]!)}`
      }
      if (Object.keys(paths).length) entries.push({ paths, lastModified: d.updatedAt })
    }
    for (const d of products) {
      const slugs = pickLocales(d.slug)
      const fam = pickLocales(relOf<{ slug?: unknown }>(d.family)?.slug)
      const paths: SitemapEntry['paths'] = {}
      for (const l of routing.locales) {
        if (slugs[l] && fam[l]) paths[l] = `/urunler/${encodeURIComponent(fam[l]!)}/${encodeURIComponent(slugs[l]!)}`
      }
      if (Object.keys(paths).length) entries.push({ paths, lastModified: d.updatedAt })
    }
    return entries
  }, [] as SitemapEntry[]))
