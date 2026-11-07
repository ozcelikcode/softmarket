import type { Locale } from '@/i18n/routing'
import { getPayloadClient, referencePath, safe } from '@/lib/site'
import { searchQuery } from '@/lib/support-query'
import { parsePage } from '@/lib/page-utils'
import { getSupportProducts } from '@/lib/support'

export type SearchResult = { id: number; title: string; href: string; kind: string }
export async function searchSite(locale: Locale, query: string, page = 1) {
  const empty = { docs: [] as SearchResult[], totalPages: 0 }
  if (!searchQuery(query) || parsePage(String(page)) === null) return empty
  return safe(async () => {
    const payload = await getPayloadClient()
    const r = await payload.find({
      collection: 'search',
      locale,
      overrideAccess: false,
      user: null,
      draft: false,
      depth: 0,
      limit: 12,
      page,
      sort: '-priority',
      select: { doc: true },
      where: { or: [{ title: { contains: query } }, { excerpt: { contains: query } }] },
    })
    const products = await getSupportProducts(locale)
    const docs: SearchResult[] = []
    for (const hit of r.docs) {
      const ref = hit.doc
      if (!['products', 'docs', 'faqs', 'posts'].includes(ref.relationTo)) continue
      const id = typeof ref.value === 'object' ? ref.value.id : ref.value
      // Never render index text: it can be stale. Resolve the public source again.
      const source = await safe(
        () =>
          payload.findByID({
            collection: ref.relationTo,
            id,
            locale,
            overrideAccess: false,
            user: null,
            draft: false,
            depth: 1,
            select:
              ref.relationTo === 'faqs'
                ? { question: true, product: true }
                : { title: true, slug: true, family: true, product: true },
            populate: { products: { slug: true }, 'product-families': { slug: true } },
          }),
        null,
      )
      if (!source) continue
      if ('product' in source && source.product) {
        const pid = typeof source.product === 'object' ? source.product.id : source.product
        if (!products.some((p) => p.id === pid)) continue
      }
      const href =
        ref.relationTo === 'faqs'
          ? '/destek/sss'
          : referencePath({ relationTo: ref.relationTo, value: source })
      const title = 'question' in source ? source.question : 'title' in source ? source.title : ''
      if (href && title) docs.push({ id: hit.id, title, href, kind: ref.relationTo })
    }
    return { docs, totalPages: r.totalPages }
  }, empty)
}
