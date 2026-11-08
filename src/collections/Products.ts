import { ValidationError, type BlocksField, type CollectionConfig, type FieldHook } from 'payload'
import { blocks as validateBlocks } from 'payload/shared'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { productBlocks } from '@/blocks'
import { layoutField, publishedAtField, sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'
import { normalizeProductLayout, validateProductLayout } from '@/lib/blocks/product-composition'

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
  ],
}
