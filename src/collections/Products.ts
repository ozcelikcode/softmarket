import { ValidationError, type BlocksField, type CollectionBeforeOperationHook, type CollectionConfig, type Field, type FieldHook } from 'payload'
import { blocks as validateBlocks } from 'payload/shared'

import { hasPanelAdminSession, isAdminOrEditor, isAdminOrEditorField, isPanelAdminField, publishedOrStaff } from '@/access'
import { productBlocks } from '@/blocks'
import { layoutField, publishedAtField, sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'
import { normalizeProductLayout, validateProductLayout } from '@/lib/blocks/product-composition'
import { LICENSING_CODE_RE } from '@/lib/licensing/constants'
import type { Product } from '@/payload-types'

/** V2: autosave drives Live Preview like `pages` (F8); autosaves only write `_products_v` (no ISR purge). */
export const PRODUCTS_AUTOSAVE_INTERVAL = 2000

const layoutValidate: BlocksField['validate'] = (value, options) => {
  const base = validateBlocks(value, options)
  if (base !== true) return base
  return validateProductLayout(value, options.req?.i18n?.language)
}

// Payload skips field validators for drafts/autosaves. The required "Teklif İste" (editions) block and the
// ordering rules are enforced at the write boundary too: REST, GraphQL, MCP, Local API and content:import.
const enforceProductLayout: FieldHook = ({ value, previousValue, req, path }) => {
  const next = normalizeProductLayout(value, previousValue)
  const result = validateProductLayout(next, req?.i18n?.language, previousValue)
  if (result !== true) throw new ValidationError({ errors: [{ path: path.join('.'), message: result }], req }, req.t)
  return next
}

/** L1: empty input is stored as NULL (several products without a code must not collide on the unique index). */
const emptyCodeToNull: FieldHook = ({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value)

const validLicensingCode = (value: unknown): value is string => typeof value === 'string' && LICENSING_CODE_RE.test(value)

const validateLicensingGroup: FieldHook = ({ value, path, req }) => {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new ValidationError({ errors: [{ path: path.join('.'), message: 'Licensing settings must be an object.' }], req }, req.t)
  }
  return value
}

const requireCodeWhenEnabled: FieldHook = ({ value, siblingData, previousSiblingDoc, path, req }) => {
  const code = siblingData.code === undefined ? previousSiblingDoc.code : siblingData.code
  if (value === true && !validLicensingCode(code)) {
    throw new ValidationError({ errors: [{ path: path.join('.'), message: 'Set the licensing code before enabling the licensing API.' }], req }, req.t)
  }
  return value
}

/**
 * L1: `licensing.code` is the lease audience embedded in shipped programs. Once stored it can never change or be
 * cleared (also not through a draft, autosave, version restore, REST, MCP or Local API).
 */
const enforceLicensingCode: FieldHook = async ({ value, previousValue, originalDoc, operation, path, req }) => {
  if (operation === 'update' && previousValue && value !== previousValue) {
    throw new ValidationError({ errors: [{ path: path.join('.'), message: 'The licensing code cannot change once set.' }], req }, req.t)
  }
  if (value != null && !validLicensingCode(value)) {
    throw new ValidationError({ errors: [{ path: path.join('.'), message: 'Use 3–41 lowercase letters, digits or hyphens, starting with a letter or digit.' }], req }, req.t)
  }
  if (validLicensingCode(value) && (operation === 'create' || value !== previousValue)) {
    // The main-table unique index cannot see codes reserved by unpublished versions.
    const { docs } = await req.payload.db.findVersions({
      collection: 'products',
      where: {
        'version.licensing.code': { equals: value },
        ...(operation === 'update' && originalDoc?.id != null ? { parent: { not_equals: originalDoc.id } } : {}),
      },
      limit: 1,
      pagination: false,
      req,
      select: { id: true },
    })
    if (docs.length) {
      throw new ValidationError({ errors: [{ path: path.join('.'), message: 'This licensing code is already used by another product.' }], req }, req.t)
    }
  }
  return value
}

// A code identifies one product. Parallel bulk saves share a transaction and can race the draft uniqueness check.
const preventBulkLicensingCodeAssignment: CollectionBeforeOperationHook = ({ args, operation, overrideAccess, req }) => {
  if (operation === 'update' && 'where' in args && validLicensingCode((args.data as Partial<Product> | undefined)?.licensing?.code)
    && (overrideAccess || hasPanelAdminSession(req))) {
    throw new ValidationError({ errors: [{ path: 'licensing.code', message: 'Set the licensing code on an individual product.' }], req }, req.t)
  }
}

/*
 * L1 licensing settings of a product (plan §4.2): staff read, admin panel session write (never a users API key),
 * never in content:import, hidden from public reads (field read access).
 */
const licensingField = {
  name: 'licensing',
  type: 'group',
  hooks: { beforeValidate: [validateLicensingGroup] },
  access: { read: isAdminOrEditorField, create: isPanelAdminField, update: isPanelAdminField },
  custom: { contentImport: false },
  admin: { position: 'sidebar' },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false,
      hooks: { beforeChange: [requireCodeWhenEnabled] },
    },
    {
      name: 'code',
      type: 'text',
      unique: true,
      maxLength: 41,
      hooks: { beforeValidate: [emptyCodeToNull], beforeChange: [enforceLicensingCode] },
    },
  ],
} satisfies Field

export const OPERATING_SYSTEMS = [
  { label: 'Windows', value: 'windows' },
  { label: 'macOS', value: 'macos' },
  { label: 'Linux', value: 'linux' },
  { label: 'Web / SaaS', value: 'web' },
  { label: 'Android', value: 'android' },
  { label: 'iOS', value: 'ios' },
  { label: 'Other', value: 'other' },
]

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'family', 'slug', '_status', 'updatedAt'],
    group: 'Catalog',
  },
  defaultSort: 'sortOrder',
  access: {
    read: publishedOrStaff,
    readVersions: isAdminOrEditor,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: { beforeOperation: [preventBulkLicensingCodeAssignment] },
  versions: { maxPerDoc: 50, drafts: { autosave: { interval: PRODUCTS_AUTOSAVE_INTERVAL } } },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview',
          fields: [
            { name: 'title', type: 'text', localized: true, required: true },
            { name: 'tagline', type: 'text', localized: true },
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            // beforeValidate sees unknown fields before Payload strips them (e.g. hidden on required blocks).
            layoutField({ blocks: productBlocks, validate: layoutValidate, hooks: { beforeValidate: [enforceProductLayout], beforeChange: [enforceProductLayout] } }),
          ],
        },
        {
          label: 'Features',
          fields: [
            {
              name: 'features',
              type: 'array',
              fields: [
                { name: 'icon', type: 'text' },
                { name: 'title', type: 'text', localized: true, required: true },
                { name: 'description', type: 'textarea', localized: true },
              ],
            },
          ],
        },
        {
          label: 'Technical',
          fields: [
            {
              name: 'specs',
              type: 'array',
              labels: { singular: 'Spec', plural: 'Specs' },
              fields: [
                { name: 'group', type: 'text', localized: true },
                { name: 'label', type: 'text', localized: true, required: true },
                { name: 'value', type: 'text', localized: true, required: true },
              ],
            },
            {
              name: 'systemRequirements',
              type: 'array',
              fields: [
                { name: 'os', type: 'select', options: OPERATING_SYSTEMS, required: true },
                { name: 'minimum', type: 'richText', localized: true },
                { name: 'recommended', type: 'richText', localized: true },
              ],
            },
          ],
        },
        {
          label: 'Media',
          fields: [
            { name: 'gallery', type: 'upload', relationTo: 'media', hasMany: true },
            { name: 'brochure', type: 'upload', relationTo: 'media' },
          ],
        },
        {
          label: 'Related',
          fields: [
            { name: 'editions', type: 'join', collection: 'editions', on: 'product', defaultSort: 'sortOrder' },
            { name: 'releases', type: 'join', collection: 'releases', on: 'product', defaultSort: '-releaseDate' },
            { name: 'downloads', type: 'join', collection: 'downloads', on: 'product' },
            { name: 'docs', type: 'join', collection: 'docs', on: 'product', defaultSort: 'sortOrder' },
          ],
        },
      ],
    },
    slugField(),
    {
      name: 'family',
      type: 'relationship',
      relationTo: 'product-families',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'industries',
      type: 'relationship',
      relationTo: 'industries',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    sortOrderField,
    publishedAtField,
    licensingField,
  ],
}
