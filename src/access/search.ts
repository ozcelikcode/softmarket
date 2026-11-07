import type { Access, Where } from 'payload'
import { isAdminOrEditorUser } from './roles'

/** A stale index entry must not expose a deleted/unpublished source through REST either. */
export const publicSearchRead: Access = async ({ req }) => {
  if (isAdminOrEditorUser(req.user)) return true
  try {
    const base = {
      overrideAccess: false as const,
      user: null,
      draft: false as const,
      depth: 0,
      limit: 10000,
      pagination: false as const,
      select: { createdAt: true as const },
    }
    const products = await req.payload.find({ collection: 'products', ...base })
    const productIds = products.docs.map((d) => d.id)
    const clauses: Where[] = []
    for (const collection of ['products', 'docs', 'faqs', 'posts'] as const) {
      const records =
        collection === 'products'
          ? products
          : await req.payload.find({
              collection,
              ...base,
              where:
                collection === 'docs'
                  ? { product: { in: productIds } }
                  : collection === 'faqs'
                    ? { or: [{ product: { exists: false } }, { product: { in: productIds } }] }
                    : undefined,
            })
      if (records.docs.length)
        clauses.push({
          and: [
            { 'doc.relationTo': { equals: collection } },
            { 'doc.value': { in: records.docs.map((d) => d.id) } },
          ],
        })
    }
    return clauses.length ? { or: clauses } : false
  } catch {
    return false
  }
}
