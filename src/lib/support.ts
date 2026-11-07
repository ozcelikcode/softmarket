import { cache } from 'react'
import type { Where } from 'payload'
import type { Locale } from '@/i18n/routing'
import { getPayloadClient, safe } from '@/lib/site'
import { relOf } from '@/lib/content'
import type { Doc, Download, Edition, Faq, Product, Release } from '@/payload-types'

const anon = (locale: Locale) => ({
  locale,
  overrideAccess: false as const,
  user: null,
  draft: false as const,
})
const populate = {
  products: { title: true, slug: true },
  media: { filename: true, url: true, alt: true },
  releases: { version: true },
  docs: { slug: true, title: true },
} as const
export type SupportProduct = Pick<Product, 'id' | 'title' | 'slug'>
export const getSupportProducts = cache(async (locale: Locale) =>
  safe(async () => {
    const r = await (
      await getPayloadClient()
    ).find({
      collection: 'products',
      ...anon(locale),
      limit: 1000,
      depth: 0,
      sort: 'sortOrder',
      select: { title: true, slug: true },
    })
    return r.docs.filter((d) => d.slug) as SupportProduct[]
  }, [] as SupportProduct[]),
)

export const getSupportEditions = async (locale: Locale) =>
  safe(async () => {
    const products = await getSupportProducts(locale)
    const r = await (
      await getPayloadClient()
    ).find({
      collection: 'editions',
      ...anon(locale),
      limit: 1000,
      depth: 0,
      sort: 'sortOrder',
      where: { product: { in: products.map((p) => p.id) } },
      select: { title: true, sku: true, product: true },
    })
    return r.docs as Edition[]
  }, [] as Edition[])

export const getReleases = async (locale: Locale, productId?: number) =>
  safe(async () => {
    const products = await getSupportProducts(locale)
    const ids = products.filter((p) => !productId || p.id === productId).map((p) => p.id)
    return (
      await (
        await getPayloadClient()
      ).find({
        collection: 'releases',
        ...anon(locale),
        limit: 1000,
        depth: 1,
        sort: '-releaseDate',
        where: { product: { in: ids } },
        select: {
          product: true,
          version: true,
          title: true,
          releaseDate: true,
          notes: true,
          changes: true,
          channel: true,
        },
        populate,
      })
    ).docs as Release[]
  }, [] as Release[])

export const getDownloads = async (
  locale: Locale,
  filters: { productId?: number; releaseId?: number; os?: string },
) =>
  safe(async () => {
    const products = await getSupportProducts(locale)
    const ids = products
      .filter((p) => !filters.productId || p.id === filters.productId)
      .map((p) => p.id)
    const and: Where[] = [{ access: { equals: 'public' } }, { product: { in: ids } }]
    if (filters.releaseId) and.push({ release: { equals: filters.releaseId } })
    if (filters.os) and.push({ os: { equals: filters.os } })
    return (
      await (
        await getPayloadClient()
      ).find({
        collection: 'downloads',
        ...anon(locale),
        limit: 200,
        depth: 1,
        sort: '-createdAt',
        where: { and },
        select: {
          title: true,
          description: true,
          product: true,
          file: true,
          os: true,
          arch: true,
          release: true,
          checksumSha256: true,
        },
        populate,
      })
    ).docs as Download[]
  }, [] as Download[])

export const getFaqs = async (locale: Locale, productId?: number, category?: string) =>
  safe(async () => {
    const products = await getSupportProducts(locale)
    const and: Where[] = [
      { or: [{ product: { exists: false } }, { product: { in: products.map((p) => p.id) } }] },
    ]
    if (productId) and.push({ product: { equals: productId } })
    if (category) and.push({ category: { equals: category } })
    return (
      await (
        await getPayloadClient()
      ).find({
        collection: 'faqs',
        ...anon(locale),
        limit: 300,
        depth: 0,
        sort: 'sortOrder',
        where: { and },
        select: { question: true, answer: true, category: true, product: true },
      })
    ).docs as Faq[]
  }, [] as Faq[])

export type DocNode = Pick<Doc, 'id' | 'title' | 'slug' | 'parent'>
export const getDocTree = cache(async (locale: Locale, productId: number) =>
  safe(async () => {
    if (!(await getSupportProducts(locale)).some((p) => p.id === productId)) return []
    return (
      await (
        await getPayloadClient()
      ).find({
        collection: 'docs',
        ...anon(locale),
        limit: 1000,
        depth: 0,
        sort: 'sortOrder',
        where: { product: { equals: productId } },
        select: { title: true, slug: true, parent: true },
      })
    ).docs.filter((d) => d.slug) as DocNode[]
  }, [] as DocNode[]),
)

/** Parent-first stable traversal; cycles and cross-product parents never recurse forever. */
export function orderDocTree(docs: DocNode[]): (DocNode & { level: number })[] {
  const out: (DocNode & { level: number })[] = []
  const seen = new Set<number>()
  const idOf = (d: DocNode) => (typeof d.parent === 'object' ? d.parent?.id : d.parent)
  const visit = (d: DocNode, level: number) => {
    if (seen.has(d.id)) return
    seen.add(d.id)
    out.push({ ...d, level })
    docs.filter((child) => idOf(child) === d.id).forEach((child) => visit(child, level + 1))
  }
  docs.filter((d) => !docs.some((p) => p.id === idOf(d))).forEach((d) => visit(d, 0))
  docs.forEach((d) => visit(d, 0))
  return out
}

export const getDoc = cache(async (locale: Locale, productId: number, slug: string) =>
  safe(async () => {
    if (!(await getSupportProducts(locale)).some((p) => p.id === productId)) return null
    const r = await (
      await getPayloadClient()
    ).find({
      collection: 'docs',
      ...anon(locale),
      limit: 1,
      depth: 1,
      where: { and: [{ product: { equals: productId } }, { slug: { equals: slug } }] },
      select: { title: true, slug: true, excerpt: true, content: true, product: true, meta: true, updatedAt: true, createdAt: true },
      populate,
    })
    return (r.docs[0] as Doc | undefined) ?? null
  }, null),
)

/** Localized dynamic support paths, matched by IDs rather than translated slug guesses. */
export const supportVariants = async (productId: number, docId?: number) =>
  safe(
    async () => {
      const payload = await getPayloadClient()
      const p = await payload.findByID({
        collection: 'products',
        id: productId,
        locale: 'all',
        fallbackLocale: false,
        overrideAccess: false,
        user: null,
        draft: false,
        depth: 0,
        select: { slug: true },
      })
      const d = docId
        ? await payload.findByID({
            collection: 'docs',
            id: docId,
            locale: 'all',
            fallbackLocale: false,
            overrideAccess: false,
            user: null,
            draft: false,
            depth: 0,
            select: { slug: true, product: true },
          })
        : null
      const paths: Partial<Record<Locale, string>> = {}
      for (const l of ['tr', 'en'] as const) {
        const ps = relOf<Record<string, string>>(p.slug)?.[l]
        const ds = relOf<Record<string, string>>(d?.slug)?.[l]
        if (ps && (!docId || ds))
          paths[l] =
            `/destek/dokumantasyon/${encodeURIComponent(ps)}${ds ? `/${encodeURIComponent(ds)}` : ''}`
      }
      return paths
    },
    {} as Partial<Record<Locale, string>>,
  )

export const getSupportSitemapEntries = async () =>
  safe(
    async () => {
      const payload = await getPayloadClient()
      const base = {
        locale: 'all' as const,
        fallbackLocale: false as const,
        overrideAccess: false as const,
        user: null,
        draft: false as const,
        limit: 1000,
      }
      const [products, docs] = await Promise.all([
        payload.find({
          collection: 'products',
          ...base,
          depth: 0,
          select: { slug: true, updatedAt: true },
        }),
        payload.find({
          collection: 'docs',
          ...base,
          depth: 1,
          select: { slug: true, product: true, updatedAt: true },
          populate: { products: { slug: true } },
        }),
      ])
      const entries: { paths: Partial<Record<Locale, string>>; lastModified?: string }[] = []
      const localeSlugs = (v: unknown) => relOf<Partial<Record<Locale, string>>>(v)
      for (const p of products.docs) {
        const paths: Partial<Record<Locale, string>> = {}
        for (const l of ['tr', 'en'] as const) {
          const slug = localeSlugs(p.slug)?.[l]
          if (slug) paths[l] = `/destek/dokumantasyon/${encodeURIComponent(slug)}`
        }
        if (Object.keys(paths).length) entries.push({ paths, lastModified: p.updatedAt })
      }
      for (const d of docs.docs) {
        const product = relOf<{ id: number; slug: unknown }>(d.product)
        if (!product || !products.docs.some((p) => p.id === product.id)) continue
        const paths: Partial<Record<Locale, string>> = {}
        for (const l of ['tr', 'en'] as const) {
          const ps = localeSlugs(product.slug)?.[l],
            ds = localeSlugs(d.slug)?.[l]
          if (ps && ds)
            paths[l] = `/destek/dokumantasyon/${encodeURIComponent(ps)}/${encodeURIComponent(ds)}`
        }
        if (Object.keys(paths).length) entries.push({ paths, lastModified: d.updatedAt })
      }
      return entries
    },
    [] as { paths: Partial<Record<Locale, string>>; lastModified?: string }[],
  )
