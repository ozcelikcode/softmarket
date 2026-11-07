import { cache } from 'react'
import type { Where } from 'payload'

import type { Locale } from '@/i18n/routing'
import { anon, getProductFamilyCounts, mediaOf, populate, relOf } from '@/lib/content'
import { clampLimit, idOf, idsOf, normalizeSort, orderByIds } from '@/lib/blocks/lists'
import type { ListSort } from '@/blocks/list-fields'
import { getPayloadClient, safe } from '@/lib/site'
import type { CaseStudy, Partner, Post, Product, ProductFamily, Solution } from '@/payload-types'

/*
 * Data loaders for the data-bound blocks (productFamilies, productShowcase, solutionsGrid, caseStudy,
 * newsList, logoWall automatic sources). Rules, all enforced here and covered by tests/unit/blocks-dynamic:
 *
 * - Anonymous, published-only reads (overrideAccess:false, user:null, draft:false), same as lib/content.ts.
 *   Manual selections are re-queried by ID through the same access rules, so a draft/unpublished record
 *   that an editor picked never renders. Page queries never populate these relationships (`maxDepth: 0`).
 * - A constant number of queries per block, independent of item count: one `find` for the records (relations
 *   are batch-populated at depth 1 with a field allowlist), an ID/slug batch for manual ordering, and the
 *   shared product counts query when needed.
 * - `cache()`-wrapped on primitive args (locale + JSON key) so the same block spec is fetched once per
 *   request; `preloadBlockData` starts all block fetches before the first block renders (no waterfall).
 * - Every loader degrades to an empty value (`safe`); an empty result hides the block.
 */

type Doc = { id: number; slug?: string | null }
const hasSlug = <T extends Doc>(docs: T[]): T[] => docs.filter((d) => d.slug)

const sortFor = (sort: ListSort, orderField: string | null, dateFields: string[]): string[] => {
  switch (sort) {
    case 'newest': return dateFields.map((f) => `-${f}`)
    case 'oldest': return dateFields
    default: return orderField ? [orderField] : dateFields.map((f) => `-${f}`)
  }
}
const idsWhere = (ids: number[]): Where => ({ id: { in: ids } })

/** Shared spec: what the editor configured, reduced to primitives (stable cache key). */
type ListSpec = { source: string; ids: number[]; ref: number | null; category: string | null; limit: number; sort: ListSort }
const key = (spec: ListSpec) => JSON.stringify(spec)
const parse = (serialized: string): ListSpec => JSON.parse(serialized) as ListSpec

/* ------------------------------------------------------------- spec builders */

type Raw = Record<string, unknown>
const text = (v: unknown) => (typeof v === 'string' && v ? v : null)

export const familiesSpec = (b: Raw, defaults = { limit: 6 }): ListSpec => ({
  source: b.source === 'manual' ? 'manual' : 'all', ids: idsOf(b.families), ref: null, category: null,
  limit: clampLimit(b.limit, defaults.limit), sort: normalizeSort(b.sort, 'order'),
})
const PRODUCT_SOURCES = ['featured', 'all', 'manual', 'byFamily', 'byIndustry']
export const productsSpec = (b: Raw): ListSpec => {
  const source = PRODUCT_SOURCES.includes(b.source as string) ? (b.source as string) : 'featured'
  return {
    source, ids: idsOf(b.products), category: null, limit: clampLimit(b.limit, 6), sort: normalizeSort(b.sort, 'order'),
    ref: source === 'byFamily' ? idOf(b.family) : source === 'byIndustry' ? idOf(b.industry) : null,
  }
}
export const solutionsSpec = (b: Raw): ListSpec => {
  const source = b.source === 'manual' || b.source === 'byIndustry' ? (b.source as string) : 'all'
  return {
    source, ids: idsOf(b.solutions), category: null, limit: clampLimit(b.limit, 4), sort: normalizeSort(b.sort, 'order'),
    ref: source === 'byIndustry' ? idOf(b.industry) : null,
  }
}
export const postsSpec = (b: Raw): ListSpec => {
  const source = b.source === 'manual' || b.source === 'category' ? (b.source as string) : 'latest'
  return {
    source, ids: idsOf(b.posts), ref: null, category: source === 'category' ? text(b.category) : null,
    limit: clampLimit(b.limit, 3), sort: normalizeSort(b.sort, 'newest'),
  }
}
export const caseStudySpec = (b: Raw): ListSpec => {
  const source = ['latest', 'manual', 'byIndustry'].includes(b.source as string) ? (b.source as string) : 'featured'
  const id = idOf(b.caseStudy)
  return {
    source, ids: id ? [id] : [], category: null, limit: 1, sort: 'newest',
    ref: source === 'byIndustry' ? idOf(b.industry) : null,
  }
}
const LOGO_SOURCES = ['allPartners', 'allCaseStudies', 'partnersAndCaseStudies']
export const logosSpec = (b: Raw): ListSpec | null => LOGO_SOURCES.includes(b.source as string)
  ? { source: b.source as string, ids: [], ref: null, category: null, limit: clampLimit(b.limit, 12), sort: 'order' }
  : null

/** A manual source with no usable selection can never produce items: skip the query. */
const emptyManual = (s: ListSpec) => s.source === 'manual' && !s.ids.length
const needsRef = (s: ListSpec) => (s.source === 'byFamily' || s.source === 'byIndustry') && s.ref === null

/** Resolve visibility before taking the first N selections. Only IDs/slugs are fetched in this extra batch;
 * the subsequent populated query stays bounded to 24 records. Never trust editor-populated objects. */
async function selectedWhere(locale: Locale, spec: ListSpec, collection: 'product-families' | 'products' | 'solutions' | 'posts'): Promise<Where> {
  if (spec.sort !== 'manual') return idsWhere(spec.ids)
  const visible = await (await getPayloadClient()).find({
    collection, ...anon(locale), where: idsWhere(spec.ids), pagination: false, limit: 0, depth: 0,
    select: { slug: true },
  })
  return idsWhere(orderByIds(visible.docs, spec.ids).slice(0, spec.limit).map((doc) => doc.id))
}

/* -------------------------------------------------------------------- loaders */

export type FamilyItem = Pick<ProductFamily, 'id' | 'title' | 'slug' | 'tagline' | 'icon' | 'image'>
export type FamiliesData = { docs: FamilyItem[]; counts: Map<number, number> }
const EMPTY_FAMILIES: FamiliesData = { docs: [], counts: new Map() }

const loadFamiliesCached = cache((locale: Locale, serialized: string, withCounts: boolean) =>
  safe(async (): Promise<FamiliesData> => {
    const spec = parse(serialized)
    if (emptyManual(spec)) return EMPTY_FAMILIES
    const [found, counts] = await Promise.all([
      getPayloadClient().then(async (payload) => payload.find({
        collection: 'product-families', ...anon(locale), pagination: false, limit: spec.limit, depth: 1,
        where: spec.source === 'manual' ? await selectedWhere(locale, spec, 'product-families') : undefined,
        sort: sortFor(spec.sort, 'sortOrder', ['createdAt']),
        select: { title: true, slug: true, tagline: true, icon: true, image: true },
        populate,
      })),
      withCounts ? getProductFamilyCounts(locale) : Promise.resolve(new Map<number, number>()),
    ])
    let docs = hasSlug(found.docs as FamilyItem[])
    if (spec.source === 'manual' && spec.sort === 'manual') docs = orderByIds(docs, spec.ids)
    return { docs: docs.slice(0, spec.limit), counts }
  }, EMPTY_FAMILIES))
export const loadFamilies = (locale: string, block: object) =>
  loadFamiliesCached(locale as Locale, key(familiesSpec(block as Raw)), (block as Raw).showCount !== false)

/**
 * Hero side panel (aside: families): first 5 of the default family list. Same spec as a default
 * productFamilies block (all, 6, order, with counts), so a home page with both shares one query.
 */
export const HERO_PANEL_FAMILIES = 5
export const loadHeroFamilies = (locale: string) => loadFamilies(locale, {})

export type ShowcaseProduct = Pick<Product, 'id' | 'title' | 'slug' | 'tagline' | 'summary' | 'heroImage' | 'family' | 'featured'>
const loadProductsCached = cache((locale: Locale, serialized: string) =>
  safe(async (): Promise<ShowcaseProduct[]> => {
    const spec = parse(serialized)
    if (emptyManual(spec) || needsRef(spec)) return []
    const and: Where[] = []
    if (spec.source === 'manual') and.push(await selectedWhere(locale, spec, 'products'))
    if (spec.source === 'featured') and.push({ featured: { equals: true } })
    if (spec.source === 'byFamily') and.push({ family: { equals: spec.ref! } })
    if (spec.source === 'byIndustry') and.push({ industries: { equals: spec.ref! } })
    const found = await (await getPayloadClient()).find({
      collection: 'products', ...anon(locale), pagination: false, limit: spec.limit, depth: 1,
      where: and.length ? { and } : undefined,
      sort: sortFor(spec.sort, 'sortOrder', ['publishedAt', 'createdAt']),
      select: { title: true, slug: true, tagline: true, summary: true, heroImage: true, family: true, featured: true },
      populate,
    })
    // The product URL needs a readable (published) family with a slug.
    let docs = (found.docs as ShowcaseProduct[]).filter((d) => d.slug && relOf<ProductFamily>(d.family)?.slug)
    if (spec.source === 'manual' && spec.sort === 'manual') docs = orderByIds(docs, spec.ids)
    return docs.slice(0, spec.limit)
  }, []))
export const loadProducts = (locale: string, block: object) => loadProductsCached(locale as Locale, key(productsSpec(block as Raw)))

export type SolutionItem = Pick<Solution, 'id' | 'title' | 'slug' | 'summary' | 'heroImage'>
const loadSolutionsCached = cache((locale: Locale, serialized: string) =>
  safe(async (): Promise<SolutionItem[]> => {
    const spec = parse(serialized)
    if (emptyManual(spec) || needsRef(spec)) return []
    const and: Where[] = []
    if (spec.source === 'manual') and.push(await selectedWhere(locale, spec, 'solutions'))
    if (spec.source === 'byIndustry') and.push({ industries: { equals: spec.ref! } })
    const found = await (await getPayloadClient()).find({
      collection: 'solutions', ...anon(locale), pagination: false, limit: spec.limit, depth: 1,
      where: and.length ? { and } : undefined,
      sort: sortFor(spec.sort, 'sortOrder', ['publishedAt', 'createdAt']),
      select: { title: true, slug: true, summary: true, heroImage: true },
      populate,
    })
    let docs = hasSlug(found.docs as SolutionItem[])
    if (spec.source === 'manual' && spec.sort === 'manual') docs = orderByIds(docs, spec.ids)
    return docs.slice(0, spec.limit)
  }, []))
export const loadSolutions = (locale: string, block: object) => loadSolutionsCached(locale as Locale, key(solutionsSpec(block as Raw)))

export type NewsItem = Pick<Post, 'id' | 'title' | 'slug' | 'excerpt' | 'coverImage' | 'category' | 'publishedAt'>
const loadPostsCached = cache((locale: Locale, serialized: string) =>
  safe(async (): Promise<NewsItem[]> => {
    const spec = parse(serialized)
    if (emptyManual(spec) || (spec.source === 'category' && !spec.category)) return []
    const and: Where[] = []
    if (spec.source === 'manual') and.push(await selectedWhere(locale, spec, 'posts'))
    if (spec.source === 'category') and.push({ category: { equals: spec.category! } })
    const found = await (await getPayloadClient()).find({
      collection: 'posts', ...anon(locale), pagination: false, limit: spec.limit, depth: 1,
      where: and.length ? { and } : undefined,
      // Posts have no sort-order field: "order" means newest first.
      sort: sortFor(spec.sort, null, ['publishedAt', 'createdAt']),
      select: { title: true, slug: true, excerpt: true, coverImage: true, category: true, publishedAt: true },
      populate,
    })
    let docs = hasSlug(found.docs as NewsItem[])
    if (spec.source === 'manual' && spec.sort === 'manual') docs = orderByIds(docs, spec.ids)
    return docs.slice(0, spec.limit)
  }, []))
export const loadPosts = (locale: string, block: object) => loadPostsCached(locale as Locale, key(postsSpec(block as Raw)))

export type FeaturedCase = Pick<CaseStudy, 'id' | 'title' | 'slug' | 'customerName' | 'customerLogo' | 'summary' | 'results' | 'featured'>
const loadCaseStudyCached = cache((locale: Locale, serialized: string) =>
  safe(async (): Promise<FeaturedCase | null> => {
    const spec = parse(serialized)
    if (emptyManual(spec) || needsRef(spec)) return null
    const and: Where[] = []
    if (spec.source === 'manual') and.push(idsWhere(spec.ids))
    if (spec.source === 'byIndustry') and.push({ industry: { equals: spec.ref! } })
    const found = await (await getPayloadClient()).find({
      collection: 'case-studies', ...anon(locale), pagination: false, limit: 1, depth: 1,
      where: and.length ? { and } : undefined,
      // `featured` first so a single query yields the featured case, else the newest.
      sort: spec.source === 'featured' ? ['-featured', '-publishedAt', '-createdAt'] : ['-publishedAt', '-createdAt'],
      select: { title: true, slug: true, customerName: true, customerLogo: true, summary: true, results: true, featured: true },
      populate,
    })
    return hasSlug(found.docs as FeaturedCase[])[0] ?? null
  }, null))
export const loadCaseStudy = (locale: string, block: object) => loadCaseStudyCached(locale as Locale, key(caseStudySpec(block as Raw)))

export type LogoItem = { name: string; media: unknown }
const loadLogosCached = cache((locale: Locale, serialized: string) =>
  safe(async (): Promise<LogoItem[]> => {
    const spec = parse(serialized)
    const payload = await getPayloadClient()
    const selected = spec.source === 'partners' || spec.source === 'caseStudies'
    if (selected && !spec.ids.length) return []
    const wantPartners = spec.source === 'allPartners' || spec.source === 'partnersAndCaseStudies' || spec.source === 'partners'
    const wantCases = spec.source === 'allCaseStudies' || spec.source === 'partnersAndCaseStudies' || spec.source === 'caseStudies'
    const [partners, cases] = await Promise.all([
      wantPartners ? payload.find({
        collection: 'partners', ...anon(locale), pagination: false, limit: spec.limit, depth: 1, sort: 'sortOrder',
        where: selected ? idsWhere(spec.ids) : { logo: { exists: true } },
        select: { name: true, logo: true }, populate,
      }).then((r) => r.docs as Pick<Partner, 'id' | 'name' | 'logo'>[]) : [],
      wantCases ? payload.find({
        collection: 'case-studies', ...anon(locale), pagination: false, limit: spec.limit, depth: 1, sort: ['-publishedAt', '-createdAt'],
        where: selected ? idsWhere(spec.ids) : { customerLogo: { exists: true } },
        select: { customerName: true, customerLogo: true, slug: true }, populate,
      }).then((r) => hasSlug(r.docs as (Pick<CaseStudy, 'customerName' | 'customerLogo' | 'id'> & { slug?: string | null })[])) : [],
    ])
    const all: LogoItem[] = [
      ...(selected ? orderByIds(partners, spec.ids) : partners).map((p) => ({ name: p.name, media: p.logo })),
      ...(selected ? orderByIds(cases, spec.ids) : cases).map((c) => ({ name: c.customerName, media: c.customerLogo })),
    ]
    const usable = all.filter((l) => l.name && (selected || mediaOf(l.media)))
    if (selected) return usable
    return usable.filter((l, i) => usable.findIndex((x) => x.name === l.name) === i).slice(0, spec.limit)
  }, []))
export const loadLogos = (locale: string, block: object) => {
  const raw = block as Raw
  // The pre-F5 selected sources have no limit field: retain all their selections, in editor order.
  const ids = idsOf(raw.source === 'partners' ? raw.partners : raw.caseStudies)
  const spec = raw.source === 'partners' || raw.source === 'caseStudies'
    ? { source: raw.source, ids, ref: null, category: null, limit: ids.length, sort: 'manual' as const }
    : logosSpec(raw)
  return spec ? loadLogosCached(locale as Locale, key(spec)) : Promise.resolve([] as LogoItem[])
}

/* -------------------------------------------------------------------- preload */

type PreloadBlock = { blockType?: string; appearance?: { hidden?: boolean | null } | null }

/**
 * Starts every data-bound block's fetch at once. The loaders are `cache()`d on the same primitive keys the
 * renderers use, so each block's later `await` joins the in-flight request. Fire-and-forget: loaders never reject.
 */
export function preloadBlockData(blocks: readonly object[] | null | undefined, locale: string): void {
  for (const item of blocks ?? []) {
    const block = item as PreloadBlock
    if (!block || block.appearance?.hidden === true) continue
    switch (block.blockType) {
      case 'productFamilies': void loadFamilies(locale, item); break
      case 'hero': if ((item as { aside?: unknown }).aside === 'families') void loadHeroFamilies(locale); break
      case 'productShowcase': void loadProducts(locale, item); break
      case 'solutionsGrid': void loadSolutions(locale, item); break
      case 'caseStudy': void loadCaseStudy(locale, item); break
      case 'newsList': void loadPosts(locale, item); break
      case 'logoWall': void loadLogos(locale, item); break
    }
  }
}
