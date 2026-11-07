import type { PayloadRequest, Where } from 'payload'

import { isCustomerUser } from './roles'

/**
 * Where clause matching licenses that are currently valid:
 * status=active, started, and either perpetual (no expiresAt) or not yet expired.
 */
export const validLicenseWhere = (customerId: number | string, now = new Date()): Where => ({
  and: [
    { customer: { equals: customerId } },
    { status: { equals: 'active' } },
    { startsAt: { less_than_equal: now.toISOString() } },
    {
      or: [{ expiresAt: { exists: false } }, { expiresAt: { greater_than: now.toISOString() } }],
    },
  ],
})

const CONTEXT_KEY = 'licensedProductIds'

/**
 * Product IDs for which the current customer holds a valid license.
 * Memoised on `req.context` so multiple access checks in one request hit the DB once.
 * Returns [] for anonymous users and staff (staff are handled separately by access functions).
 */
export const getLicensedProductIds = async (req: PayloadRequest): Promise<number[]> => {
  const { user } = req
  if (!isCustomerUser(user)) return []

  const cached = req.context[CONTEXT_KEY]
  if (Array.isArray(cached)) return cached as number[]

  const result = await req.payload.find({
    collection: 'licenses',
    where: validLicenseWhere(user.id),
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    req,
    select: { product: true },
  })

  const ids = Array.from(
    new Set(
      result.docs
        .map((doc) => (typeof doc.product === 'object' && doc.product ? doc.product.id : doc.product))
        .filter((id): id is number => typeof id === 'number'),
    ),
  )

  req.context[CONTEXT_KEY] = ids
  return ids
}
