import config from '@payload-config'
import { cache } from 'react'
import { getPayload } from 'payload'

import { routePath } from '@/i18n/paths'
import type { Locale } from '@/i18n/routing'
import { publicText, safeHref } from '@/lib/utils'

/** Loose shape of the `linkField()` group; works for header, footer and nested arrays. */
export type LinkGroup = {
  type?: 'internal' | 'external' | 'route' | null
  newTab?: boolean | null
  reference?: { relationTo: string; value: unknown } | null
  /** F7: locale-independent canonical route key (see `src/i18n/paths.ts` LINK_ROUTES). */
  route?: string | null
  routeParam?: string | null
  url?: string | null
  label?: string | null
} | null | undefined

export type NavLink = { label: string; href: string; newTab?: boolean; description?: string }
export type PublicImage = { url: string; alt: string; width?: number | null; height?: number | null }
export type MegaColumn = { title?: string; links: NavLink[] }
export type MegaFeatured = { title: string; description?: string; image?: PublicImage; link?: NavLink }
export type NavItem = {
  label: string
  href?: string
  newTab?: boolean
  mega?: 'products' | 'solutions' | 'custom'
  children?: NavLink[]
  /** `mega: 'custom'` only. */
  columns?: MegaColumn[]
  featured?: MegaFeatured
}
export type Announcement = { id: string; text: string; link?: NavLink; dismissible: boolean }
export type UtilityConfig = { links: NavLink[]; showSearch: boolean; showLanguage: boolean; showAccount: boolean }
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

/** Canonical (TR) target of a link group, before locale resolution (AppLink/localizedHref). */
export function linkTarget(link: LinkGroup): string | null {
  if (!link) return null
  if (link.type === 'route') return routePath(link.route, link.routeParam)
  return safeHref(link.type === 'external' ? link.url : referencePath(link.reference))
}

export function resolveLink(link: LinkGroup): NavLink | null {
  if (!link?.label) return null
  const href = linkTarget(link)
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
  if (link?.type === 'external' || link?.type === 'route') return resolveLink(link)
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

const mediaSelect = { url: true, filename: true, alt: true, width: true, height: true, mimeType: true, protected: true } as const

/** Public (unprotected, anonymously readable) image or null. */
export function publicImage(value: unknown, fallbackAlt = ''): PublicImage | null {
  if (!value || typeof value !== 'object') return null
  const m = value as { url?: unknown; alt?: unknown; width?: number | null; height?: number | null; protected?: unknown; mimeType?: unknown }
  if (m.protected !== false || typeof m.url !== 'string' || !safeHref(m.url) || !/^(?:https?:\/\/|\/)/i.test(m.url)) return null
  if (typeof m.mimeType !== 'string' || !m.mimeType.startsWith('image/')) return null
  return { url: m.url, alt: typeof m.alt === 'string' && m.alt ? m.alt : fallbackAlt, width: m.width ?? null, height: m.height ?? null }
}

const getPublicMedia = cache(async (id: number | string, locale: Locale) =>
  safe(async () => (await getPayloadClient()).findByID({
    collection: 'media', id, locale, depth: 0, overrideAccess: false, user: null, draft: false, select: mediaSelect,
  }), null),
)

const mediaID = (value: unknown) =>
  typeof value === 'number' || typeof value === 'string' ? value
    : value && typeof value === 'object' && 'id' in value ? (value as { id: number | string }).id : null

export const getSiteSettings = cache(async (locale: Locale) =>
  safe(async () => (await getPayloadClient()).findGlobal({
    slug: 'site-settings', locale, depth: 1, overrideAccess: false, user: null, draft: false,
    // Public chrome only: no company tax/KEP data, no form or legal relations.
    select: {
      siteName: true, tagline: true, social: true, contact: true,
      logo: true, logoDark: true, favicon: true, brand: true, motion: true,
    },
    populate: { media: mediaSelect },
  }), null),
)

/** Site name/logo/brand values with placeholders removed; `fallbackName` comes from i18n. */
export function siteIdentity(settings: Awaited<ReturnType<typeof getSiteSettings>>, fallbackName: string) {
  const name = publicText(settings?.siteName) ?? fallbackName
  const logo = publicImage(settings?.logo, name)
  const logoDark = publicImage(settings?.logoDark, name)
  return {
    name,
    tagline: publicText(settings?.tagline),
    /** Header/footer default to dark surfaces. */
    logoOnDark: logoDark ?? logo,
    logoOnLight: logo ?? logoDark,
    favicon: publicImage(settings?.favicon, name),
    accent: settings?.brand?.accent ?? null,
    motion: settings?.motion === 'none' ? ('none' as const) : ('subtle' as const),
  }
}

/** Public contact rows; empty/placeholder values are dropped so their sections hide. */
export function publicContact(settings: { contact?: Record<string, unknown> | null } | null | undefined) {
  const c = settings?.contact ?? {}
  const email = publicText(c.email)
  const phone = publicText(c.phone)
  const tel = phone ? phone.replace(/[^\d+]/g, '') : ''
  return {
    address: publicText(c.address),
    email: email && safeHref(`mailto:${email}`) ? email : null,
    salesEmail: publicText(c.salesEmail),
    supportEmail: publicText(c.supportEmail),
    phone: phone && tel.replace('+', '').length >= 5 ? { label: phone, href: `tel:${tel}` } : null,
    workingHours: publicText(c.workingHours),
    mapUrl: publicText(c.mapUrl),
  }
}

async function resolveLinks(rows: { link?: unknown; description?: string | null }[] | null | undefined, locale: Locale) {
  const links = await Promise.all((rows ?? []).map(async (row) => {
    const link = await resolvePublicLink(row.link as LinkGroup, locale)
    return link ? { ...link, description: publicText(row.description) ?? undefined } : null
  }))
  return links.filter((l): l is NavLink & { description: string | undefined } => Boolean(l))
}

/** Stable short id so a changed announcement shows again after a visitor dismissed the old one. */
function announcementID(text: string, href = '') {
  let hash = 5381
  for (const ch of `${text}|${href}`) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0
  return hash.toString(36)
}

export const getHeaderNav = cache(async (locale: Locale) => {
  const data = await safe(
    async () => (await getPayloadClient()).findGlobal({
      slug: 'header', locale, depth: 0, overrideAccess: false, user: null, draft: false,
      select: { navItems: true, cta: true, announcement: true, utility: true },
    }),
    null,
  )
  const items: NavItem[] = []
  for (const row of data?.navItems ?? []) {
    const link = await resolvePublicLink(row.link as LinkGroup, locale)
    const label = (row.link as LinkGroup)?.label
    if (!label) continue
    const children = row.megaMenu === 'custom' ? [] : await resolveLinks(row.children, locale)
    let columns: MegaColumn[] = []
    let featured: MegaFeatured | undefined
    if (row.megaMenu === 'custom') {
      columns = (await Promise.all((row.columns ?? []).map(async (col) => ({
        title: publicText(col.title) ?? undefined,
        links: await resolveLinks(col.links, locale),
      })))).filter((col) => col.links.length)
      const f = row.featured
      const title = publicText(f?.title)
      if (title) {
        const id = mediaID(f?.image)
        featured = {
          title,
          description: publicText(f?.description) ?? undefined,
          image: (id !== null ? publicImage(await getPublicMedia(id, locale), title) : null) ?? undefined,
          link: (await resolvePublicLink(f?.link as LinkGroup, locale)) ?? undefined,
        }
      }
    }
    const custom = row.megaMenu === 'custom' && (columns.length || featured)
    if (!link && !children.length && !custom && row.megaMenu !== 'products' && row.megaMenu !== 'solutions') continue
    items.push({
      label,
      href: link?.href,
      newTab: link?.newTab,
      // A custom mega menu without content degrades to a plain link.
      mega: row.megaMenu === 'custom' ? (custom ? 'custom' : undefined) : (row.megaMenu ?? undefined),
      children: children.length ? children : undefined,
      columns: columns.length ? columns : undefined,
      featured,
    })
  }
  const [cta, secondaryCta] = await Promise.all([
    resolvePublicLink(data?.cta?.link as LinkGroup, locale),
    resolvePublicLink(data?.cta?.secondary as LinkGroup, locale),
  ])
  const a = data?.announcement
  const text = a?.enabled ? publicText(a.text) : null
  const announcementLink = text ? await resolvePublicLink(a?.link as LinkGroup, locale) : null
  const announcement: Announcement | null = text
    ? { id: announcementID(text, announcementLink?.href), text, link: announcementLink ?? undefined, dismissible: a?.dismissible !== false }
    : null
  const u = data?.utility
  const utility: UtilityConfig = {
    links: await resolveLinks(u?.links, locale),
    showSearch: u?.showSearch !== false,
    showLanguage: u?.showLanguage !== false,
    showAccount: u?.showAccount !== false,
  }
  return { items, cta, secondaryCta, announcement, utility }
})

export const getFooterData = cache(async (locale: Locale) => {
  const data = await safe(
    async () => (await getPayloadClient()).findGlobal({
      slug: 'footer', locale, depth: 0, overrideAccess: false, user: null, draft: false,
      select: { columns: true, legalLinks: true, copyright: true, brandBlurb: true, showContact: true, showSocial: true },
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
  return {
    columns: columns.filter((c) => c.links.length && publicText(c.title)),
    legal,
    copyright: publicText(data?.copyright),
    brandBlurb: publicText(data?.brandBlurb),
    showContact: data?.showContact !== false,
    showSocial: data?.showSocial !== false,
  }
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
