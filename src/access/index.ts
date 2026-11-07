import { NotFound, type Access, type FieldAccess, type PayloadRequest, type Where } from 'payload'

import { MEDIA_IMAGE_WIDTHS } from '@/lib/media-sizes'

import { getLicensedProductIds } from './licenses'
import { isAdminOrEditorUser, isAdminUser, isCustomerUser, isStaffUser } from './roles'

export * from './roles'
export { getLicensedProductIds, validLicenseWhere } from './licenses'

/*
 * IMPORTANT: Payload's default access is `Boolean(req.user)`. Because portal customers are
 * also authenticated users, EVERY collection/global must declare explicit access using the
 * helpers below. Never rely on the default.
 */

export const anyone: Access = () => true
export const nobody: Access = () => false

export const isAdmin: Access = ({ req: { user } }) => isAdminUser(user)

export const isAdminOrEditor: Access = ({ req: { user } }) => isAdminOrEditorUser(user)

export const isAdminField: FieldAccess = ({ req: { user } }) => isAdminUser(user)

export const isAdminOrEditorField: FieldAccess = ({ req: { user } }) => isAdminOrEditorUser(user)

/** Panel access (`access.admin`): only staff in the `users` collection. */
export const canAccessAdminPanel = ({ req: { user } }: { req: PayloadRequest }): boolean =>
  isAdminOrEditorUser(user)

/** Staff see everything (drafts included); everyone else only published documents. */
export const publishedOrStaff: Access = ({ req: { user } }) => {
  if (isAdminOrEditorUser(user)) return true
  return { _status: { equals: 'published' } }
}

/**
 * Customers read only documents whose `customer` relation points to themselves.
 * Staff (admin/editor) read all. Anonymous users read nothing.
 */
export const isOwnerCustomer =
  (field = 'customer'): Access =>
  ({ req: { user } }) => {
    if (isAdminOrEditorUser(user)) return true
    if (isCustomerUser(user)) return { [field]: { equals: user.id } } as Where
    return false
  }

/** Same as isOwnerCustomer but staff access is limited to admins (commerce data). */
export const isAdminOrOwnerCustomer =
  (field = 'customer'): Access =>
  ({ req: { user } }) => {
    if (isAdminUser(user)) return true
    if (isCustomerUser(user)) return { [field]: { equals: user.id } } as Where
    return false
  }

/** Customers collection: staff, or the customer reading/updating their own record. */
export const isStaffOrSelfCustomer: Access = ({ req: { user } }) => {
  if (isAdminOrEditorUser(user)) return true
  if (isCustomerUser(user)) return { id: { equals: user.id } }
  return false
}

/** Users collection: admins manage everyone; staff may update their own record. */
export const isAdminOrSelfUser: Access = ({ req: { user } }) => {
  if (isAdminUser(user)) return true
  if (isStaffUser(user)) return { id: { equals: user.id } }
  return false
}

/**
 * Downloads read access:
 *  - staff: everything
 *  - everyone: `access=public`
 *  - customers: additionally `access=licensed` for products they hold a valid license for
 */
export const downloadsRead: Access = async ({ req }) => {
  if (isAdminOrEditorUser(req.user)) return true
  const publicWhere: Where = { access: { equals: 'public' } }
  const productIds = await getLicensedProductIds(req)
  if (productIds.length === 0) return publicWhere
  return {
    or: [
      publicWhere,
      { and: [{ access: { equals: 'licensed' } }, { product: { in: productIds } }] },
    ],
  }
}

/** Protected uploads stay closed without an authorizing reference, including during attachment/deletion. */
export const mediaRead: Access = async ({ req, data, isReadingStaticFile }) => {
  // Hide both missing and inaccessible filenames. Payload normally returns 403
  // for either when an access filter does not match.
  const checkStatic = async (access: true | Where) => {
    if (!isReadingStaticFile || typeof data?.filename !== 'string') return access
    const filename: Where = { or: ['filename', ...Object.keys(MEDIA_IMAGE_WIDTHS).map(name => `sizes.${name}.filename`)]
      .map(field => ({ [field]: { equals: data.filename } })) }
    // Legacy derivatives could share a filename with a different media record.
    // A public match must never authorize bytes belonging to a protected match.
    const matches = await req.payload.find({
      collection: 'media', where: filename, depth: 0, limit: 2,
      overrideAccess: true, req, select: { filename: true },
    })
    if (matches.docs.length !== 1 || matches.totalDocs !== 1) throw new NotFound(req.t)
    const { docs } = await req.payload.find({
      collection: 'media', where: access === true ? filename : { and: [filename, access] },
      depth: 0, limit: 1, pagination: false, overrideAccess: true, req,
      select: { filename: true },
    })
    if (docs.length === 0) throw new NotFound(req.t)
    return access
  }
  if (isAdminOrEditorUser(req.user)) return checkStatic(true)
  const productIds = await getLicensedProductIds(req)
  const { docs } = await req.payload.find({
    collection: 'downloads',
    depth: 0, limit: 0, pagination: false, overrideAccess: true, req,
    select: { file: true, product: true, access: true },
  })
  const blocked = new Set<number>()
  const permitted = new Set<number>()
  const publicFiles = new Set<number>()
  for (const doc of docs) {
    const file = typeof doc.file === 'object' && doc.file ? doc.file.id : doc.file
    const product = typeof doc.product === 'object' && doc.product ? doc.product.id : doc.product
    if (typeof file !== 'number') return false
    if (doc.access === 'public') {
      publicFiles.add(file)
      continue
    }
    blocked.add(file)
    if (doc.access === 'licensed' && typeof product === 'number' && productIds.includes(product)) permitted.add(file)
  }
  const denied = [...blocked].filter((id) => !permitted.has(id))
  const manual: Where = productIds.length
    ? { or: [{ and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }] },
        { and: [{ visibility: { equals: 'licensed' } }, { licensedProducts: { in: productIds } }] }] }
    : { and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }] }
  const allowedReferences = [...permitted, ...[...publicFiles].filter((id) => !blocked.has(id))]
  const visibility: Where = allowedReferences.length
    ? { or: [manual, { id: { in: allowedReferences } }] }
    : manual
  return checkStatic(denied.length ? { and: [visibility, { id: { not_in: denied } }] } : visibility)
}
