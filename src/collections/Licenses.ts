import type { CollectionAfterOperationHook, CollectionBeforeDeleteHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError, ValidationError } from 'payload'

import { notifyLicenseAssigned } from '@/lib/email/license-assigned'

import { hasPanelAdminSession, isAdmin, isAdminField, isAdminOrOwnerCustomer, isPanelAdminField, nobodyField } from '@/access'
import { generateLicenseKey, isValidLicenseKeyFormat, normalizeLicenseKey } from '@/lib/licenses/generate'
import { LICENSE_STATUSES, addMonths } from '@/lib/licenses/validity'
import { LICENSE_STATUS_REASONS, LICENSE_STATUS_SOURCES } from '@/lib/licensing/constants'
import { adminAction } from '@/lib/licensing/admin/routes'
import { generatePublicId } from '@/lib/licensing/public-id'
import { logLicenseTransition, stampLicenseTransition } from '@/lib/licensing/transitions'

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
  // L1: opaque public id (API `lic_…`), server-generated and immutable; client input is stripped by field access.
  if (operation === 'create') next.publicId = generatePublicId()
  else next.publicId = originalDoc?.publicId ?? generatePublicId()
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
      disableErrors: true,
      req,
    })
    if (!edition) {
      throw new ValidationError({ collection: 'licenses', errors: [{ path: 'edition', message: 'License edition was not found.' }], req }, req.t)
    }
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

/**
 * L1: a license that has a status history or device activations is a commercial/security record and cannot be deleted
 * (the log keeps license lifetime + 10 years). Without this guard the NOT NULL foreign keys would fail with a raw error.
 */
const LICENSE_HISTORY_CONFLICT = 'License has licensing history and cannot be deleted. Revoke it instead.'

const keepLicensingHistory: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ['license-status-log', 'license-activations'] as const) {
    const { totalDocs } = await req.payload.count({ collection, where: { license: { equals: id } }, overrideAccess: true, req })
    if (totalDocs > 0) throw new APIError(LICENSE_HISTORY_CONFLICT, 409, null, true)
  }
}

// Payload catches per-document bulk errors. Throw before its outer SQLite transaction can commit a partial write.
const rejectFailedLicenseBulkWrite: CollectionAfterOperationHook = ({ operation, result }) => {
  if (operation === 'update' && result.errors.length) {
    throw new APIError('License bulk update failed. No changes were saved.', 400, null, true)
  }
  if (operation === 'delete' && result.errors.some(({ message }) => message === LICENSE_HISTORY_CONFLICT)) {
    throw new APIError(LICENSE_HISTORY_CONFLICT, 409, null, true)
  }
  return result
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
  hooks: {
    beforeValidate: [prepareLicense],
    beforeChange: [stampLicenseTransition],
    // Log first: the status log is part of the change; the e-mail hook only schedules a notification.
    afterChange: [logLicenseTransition, notifyLicenseAssigned],
    afterOperation: [rejectFailedLicenseBulkWrite],
    beforeDelete: [keepLicensingHistory],
  },
  // L6b: suspend / revoke / restore / reactivate with reason, audit and optimistic concurrency (never MCP).
  endpoints: [
    adminAction('/:id/suspend', 'license.suspend'),
    adminAction('/:id/revoke', 'license.revoke'),
    adminAction('/:id/restore', 'license.restore'),
    adminAction('/:id/reactivate', 'license.reactivate'),
  ],
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
      // L6b "Lisans işlemleri": status, devices, history and the admin actions (`ui`: no column). Panel admin only.
      name: 'licenseActions',
      type: 'ui',
      label: { tr: 'Lisans işlemleri', en: 'License actions' },
      admin: { position: 'sidebar', components: { Field: '@/admin/fields/license-actions#LicenseActions' } },
    },
    {
      name: 'publicId',
      type: 'text',
      unique: true,
      // Server-generated in prepareLicense; nobody writes it through any API.
      access: { create: nobodyField, update: nobodyField },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'maxDevices',
      type: 'number',
      min: 1,
      validate: (value: unknown) => value == null || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1)
        ? true
        : 'The device limit must be a positive whole number.',
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: LICENSE_STATUSES.map((s) => ({ label: s, value: s })),
      // L1 (plan T6): a users API key (MCP/REST) can never set the status on create. L6b follow-up (plan §4.1): nobody
      // changes it through a user-facing update (panel form, REST, Local API with overrideAccess false); it changes only
      // via the L6b action endpoints, payment fulfilment/refund/dispute and the L5 rule engine, all server code with
      // overrideAccess (field access is skipped there). Submitted values are stripped. Every change is stamped and
      // logged (src/lib/licensing/transitions.ts).
      access: { create: isPanelAdminField, update: nobodyField },
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: {
          tr: 'Salt okunur. Durumu yan paneldeki "Lisans işlemleri" ile değiştirin.',
          en: 'Read-only. Change the status with "License actions" in the side panel.',
        },
      },
    },
    {
      name: 'statusReason',
      type: 'select',
      options: LICENSE_STATUS_REASONS.map((s) => ({ label: s, value: s })),
      access: { read: isAdminField, create: nobodyField, update: nobodyField },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'statusSource',
      type: 'select',
      options: LICENSE_STATUS_SOURCES.map((s) => ({ label: s, value: s })),
      access: { read: isAdminField, create: nobodyField, update: nobodyField },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'statusChangedAt',
      type: 'date',
      access: { read: isAdminField, create: nobodyField, update: nobodyField },
      admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      // Payload 3.93's GraphQL schema builder fails on a native join to a GraphQL-disabled collection.
      name: 'activations',
      type: 'json',
      virtual: true,
      admin: { readOnly: true },
      access: {
        create: nobodyField,
        update: nobodyField,
        read: ({ req }) => req.payloadAPI !== 'GraphQL' && hasPanelAdminSession(req),
      },
      hooks: {
        afterRead: [async ({ req, originalDoc, findMany, currentDepth }) => {
          if (req.payloadAPI === 'GraphQL' || !hasPanelAdminSession(req)
            || findMany || currentDepth !== 1 || typeof originalDoc?.id !== 'number') return undefined
          const { docs, totalDocs, hasNextPage } = await req.payload.find({
            collection: 'license-activations',
            where: { license: { equals: originalDoc.id } },
            req, overrideAccess: false, depth: 0, sort: '-activatedAt', limit: 10,
            select: { publicId: true, status: true, deviceLabel: true, platform: true, lastSeenAt: true },
          })
          return { docs, totalDocs, hasNextPage }
        }],
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { position: 'sidebar' },
      access: { read: ({ req: { user } }) => Boolean(user && user.collection === 'users') },
    },
  ],
}
