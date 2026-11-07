import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, layoutField, publishedAtField, sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

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
  versions: draftVersions,
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
            layoutField(),
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
