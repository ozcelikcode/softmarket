import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { isAdmin, isAdminOrOwnerCustomer } from '@/access'
import { generateLicenseKey, isValidLicenseKeyFormat, normalizeLicenseKey } from '@/lib/licenses/generate'
import { LICENSE_STATUSES, addMonths } from '@/lib/licenses/validity'

const relId = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'number') return value.id
  return undefined
}

/**
 * - key: generated (CSPRNG) on create by the server and immutable afterwards
 * - product: denormalised from edition (used by download access queries)
 * - expiresAt: startsAt + durationMonths for subscription editions when not set explicitly
 * - seats: defaults to the edition's seats
 */
const prepareLicense: CollectionBeforeValidateHook = async ({ data, originalDoc, operation, req }) => {
  const next = { ...data }

  if (operation === 'create') next.key = generateLicenseKey()
  else if (originalDoc) next.key = originalDoc.key
  if (typeof next.key === 'string') {
    next.key = normalizeLicenseKey(next.key)
    if (!isValidLicenseKeyFormat(next.key)) {
      throw new ValidationError({
        collection: 'licenses',
        errors: [{ path: 'key', message: 'Invalid license key format.' }],
      })
    }
  }

  const editionId = relId(next.edition ?? originalDoc?.edition)
  if (editionId) {
    const edition = await req.payload.findByID({
      collection: 'editions',
      id: editionId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    next.product = relId(edition.product)
    if (next.seats === undefined || next.seats === null) next.seats = originalDoc?.seats ?? edition.seats

    const startsAt = new Date(next.startsAt ?? originalDoc?.startsAt ?? Date.now())
    next.startsAt = startsAt.toISOString()
    const hasExpiry = next.expiresAt !== undefined ? Boolean(next.expiresAt) : Boolean(originalDoc?.expiresAt)
    if (edition.licenseType === 'subscription' && edition.durationMonths && !hasExpiry) {
      next.expiresAt = addMonths(startsAt, edition.durationMonths).toISOString()
    }
  }

  return next
}

/** Licenses are written ONLY by server code (overrideAccess) or admins. Customers can read their own. */
export const Licenses: CollectionConfig = {
  slug: 'licenses',
  admin: {
    useAsTitle: 'key',
    defaultColumns: ['key', 'customer', 'edition', 'status', 'expiresAt'],
    group: 'Licenses',
  },
  defaultSort: '-createdAt',
  access: {
    read: isAdminOrOwnerCustomer('customer'),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { beforeValidate: [prepareLicense] },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      defaultValue: () => generateLicenseKey(),
      admin: { readOnly: true, description: 'Generated automatically (CSPRNG). Format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'customer', type: 'relationship', relationTo: 'customers', required: true, index: true },
        { name: 'edition', type: 'relationship', relationTo: 'editions', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'product',
          type: 'relationship',
          relationTo: 'products',
          index: true,
          admin: { readOnly: true, description: 'Derived from edition.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          defaultValue: () => new Date().toISOString(),
          index: true,
        },
        {
          name: 'expiresAt',
          type: 'date',
          index: true,
          admin: { description: 'Empty = perpetual.' },
        },
        { name: 'seats', type: 'number', min: 1 },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: LICENSE_STATUSES.map((s) => ({ label: s, value: s })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { position: 'sidebar' },
      access: { read: ({ req: { user } }) => Boolean(user && user.collection === 'users') },
    },
  ],
}
