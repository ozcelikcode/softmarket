import config from '@payload-config'
import { cache } from 'react'
import { getPayload } from 'payload'

import type { Locale } from '@/i18n/routing'
import { safeHref } from '@/lib/utils'

/** Loose shape of the `linkField()` group; works for header, footer and nested arrays. */
export type LinkGroup = {
  type?: 'internal' | 'external' | null
  newTab?: boolean | null
  reference?: { relationTo: string; value: unknown } | null
  url?: string | null
  label?: string | null
} | null | undefined

export type NavLink = { label: string; href: string; newTab?: boolean; description?: string }
export type NavItem = {
  label: string
  href?: string
  newTab?: boolean
  mega?: 'products' | 'solutions'
  children?: NavLink[]
}
export type MegaFamily = { title: string; href: string; tagline?: string; products: NavLink[] }
export type MegaData = { families: MegaFamily[]; solutions: NavLink[] }

type Doc = { slug?: string; title?: string; pageType?: string; family?: unknown; product?: unknown }
const asDoc = (v: unknown): Doc | null => (v && typeof v === 'object' ? (v as Doc) : null)

/** Canonical (Turkish) path for an internal CMS reference. */
export function referencePath(ref: NonNullable<LinkGroup>['reference']): string | null {
  if (!ref) return null
  const doc = asDoc(ref.value)
  const slug = typeof doc?.slug === 'string' ? encodeURIComponent(doc.slug) : null
  if (!doc || !slug) return null
  switch (ref.relationTo) {
    case 'pages':
      if (doc.pageType === 'legal') return `/yasal/${slug}`
      if (doc.slug === 'home') return '/'
      if (doc.slug === 'hakkimizda' || doc.slug === 'about') return '/sirket/hakkimizda'
      return null
    case 'product-families':
      return `/urunler/${slug}`
    case 'products': {
      const fam = asDoc(doc.family)
      return fam?.slug ? `/urunler/${encodeURIComponent(fam.slug)}/${slug}` : '/urunler'
    }
    case 'solutions':
      return `/cozumler/${slug}`
    case 'industries':
      return `/cozumler?sektor=${slug}`
    case 'case-studies':
      return `/referanslar/${slug}`
    case 'posts':
      return `/haberler/${slug}`
    case 'careers':
      return `/kariyer/${slug}`
    case 'docs': {
      const prod = asDoc(doc.product)
      return prod?.slug ? `/destek/dokumantasyon/${encodeURIComponent(prod.slug)}/${slug}` : '/destek/dokumantasyon'
    }
    default:
      return null
  }
}

export function resolveLink(link: LinkGroup): NavLink | null {
  if (!link?.label) return null
  const href = safeHref(link.type === 'external' ? link.url : referencePath(link.reference))
  if (!href) return null
  return { label: link.label, href, newTab: Boolean(link.newTab) }
}

export const getPayloadClient = cache(() => getPayload({ config }))

// Read references separately: linkField.maxDepth=1 otherwise leaves a product's family as an ID.
// Projection and depth prevent traversal into unrelated records or protected uploads.
const referenceSelect = {
  pages: { slug: true, pageType: true },
  'product-families': { slug: true },
  products: { slug: true, family: true },
  solutions: { slug: true },
  industries: { slug: true },
  'case-studies': { slug: true },
  posts: { slug: true },
  careers: { slug: true },
  docs: { slug: true, product: true },
} as const

const getPublicReference = cache(async (collection: keyof typeof referenceSelect, id: number | string, locale: Locale) =>
  safe(async () => (await getPayloadClient()).findByID({
    collection, id, locale, overrideAccess: false, user: null, draft: false,
    depth: 1,
    select: referenceSelect[collection],
    populate: { 'product-families': { slug: true }, products: { slug: true } },
  }), null),
)

async function resolvePublicLink(link: LinkGroup, locale: Locale): Promise<NavLink | null> {
  if (link?.type === 'external') return resolveLink(link)
  const ref = link?.reference
  if (!ref || !Object.hasOwn(referenceSelect, ref.relationTo)) return null
  const id = typeof ref.value === 'object' && ref.value && 'id' in ref.value ? ref.value.id : ref.value
  if (typeof id !== 'string' && typeof id !== 'number') return null
  const doc = await getPublicReference(ref.relationTo as keyof typeof referenceSelect, id, locale)
  return doc ? resolveLink({ ...link, reference: { relationTo: ref.relationTo, value: doc } }) : null
}

export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export const getSiteSettings = cache(async (locale: Locale) =>
  safe(async () => (await getPayloadClient()).findGlobal({
    slug: 'site-settings', locale, depth: 0, overrideAccess: false, user: null, draft: false,
    select: { siteName: true, tagline: true, social: true },
  }), null),
)

export const getHeaderNav = cache(async (locale: Locale) => {
  const data = await safe(
    async () => (await getPayloadClient()).findGlobal({
      slug: 'header', locale, depth: 0, overrideAccess: false, user: null, draft: false,
      select: { navItems: true, cta: true },
    }),
    null,
  )
  const items: NavItem[] = []
  for (const row of data?.navItems ?? []) {
    const link = await resolvePublicLink(row.link as LinkGroup, locale)
    const label = (row.link as LinkGroup)?.label
    if (!label) continue
    const children: NavLink[] = []
    for (const c of row.children ?? []) {
      const l = await resolvePublicLink(c.link as LinkGroup, locale)
      if (l) children.push({ ...l, description: c.description ?? undefined })
    }
    if (!link && !row.megaMenu && !children.length) continue
    items.push({
      label,
      href: link?.href,
      newTab: link?.newTab,
      mega: row.megaMenu ?? undefined,
      children: children.length ? children : undefined,
    })
  }
  const cta = await resolvePublicLink(data?.cta?.link as LinkGroup, locale)
  return { items, cta }
})

export const getFooterData = cache(async (locale: Locale) => {
  const data = await safe(
    async () => (await getPayloadClient()).findGlobal({
      slug: 'footer', locale, depth: 0, overrideAccess: false, user: null, draft: false,
      select: { columns: true, legalLinks: true, copyright: true },
    }),
    null,
  )
  const columns = await Promise.all((data?.columns ?? []).map(async (col) => ({
    title: col.title,
    links: (await Promise.all((col.links ?? [])
      .map((l) => resolvePublicLink(l.link as LinkGroup, locale))))
      .filter((l): l is NavLink => Boolean(l)),
  })))
  const legal = (await Promise.all((data?.legalLinks ?? [])
    .map((l) => resolvePublicLink(l.link as LinkGroup, locale))))
    .filter((l): l is NavLink => Boolean(l))
  return { columns: columns.filter((c) => c.links.length), legal, copyright: data?.copyright ?? null }
})

/** Product families with their published products, plus solutions, for mega menus. */
export const getMegaData = cache(async (locale: Locale): Promise<MegaData> => {
  return safe(
    async () => {
      const payload = await getPayloadClient()
      const [families, products, solutions] = await Promise.all([
        payload.find({
          collection: 'product-families', locale, limit: 8, depth: 0, sort: 'sortOrder',
          overrideAccess: false, user: null, draft: false,
          select: { title: true, slug: true, tagline: true },
        }),
        payload.find({
          collection: 'products',
          overrideAccess: false, user: null, draft: false,
          select: { title: true, slug: true, tagline: true, family: true },
          locale,
          limit: 60,
          depth: 0,
          sort: 'sortOrder',
          where: { _status: { equals: 'published' } },
        }),
        payload.find({
          collection: 'solutions',
          overrideAccess: false, user: null, draft: false,
          select: { title: true, slug: true },
          locale,
          limit: 8,
          depth: 0,
          sort: 'sortOrder',
          where: { _status: { equals: 'published' } },
        }),
      ])
      return {
        families: families.docs.filter((f) => f.slug).map((f) => ({
          title: f.title,
          tagline: f.tagline ?? undefined,
          href: `/urunler/${encodeURIComponent(f.slug!)}`,
          products: products.docs
            .filter((p) => p.slug && (typeof p.family === 'object' ? p.family?.id : p.family) === f.id)
            .map((p) => ({
              label: p.title,
              description: p.tagline ?? undefined,
              href: `/urunler/${encodeURIComponent(f.slug!)}/${encodeURIComponent(p.slug!)}`,
            })),
        })),
        solutions: solutions.docs.filter((s) => s.slug).map((s) => ({ label: s.title, href: `/cozumler/${encodeURIComponent(s.slug!)}` })),
      }
    },
    { families: [], solutions: [] },
  )
})
