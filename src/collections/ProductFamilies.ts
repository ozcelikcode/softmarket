import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const ProductFamilies: CollectionConfig = {
  slug: 'product-families',
  labels: { singular: 'Product Family', plural: 'Product Families' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'sortOrder'], group: 'Catalog' },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', localized: true, required: true },
            { name: 'tagline', type: 'text', localized: true },
            { name: 'description', type: 'richText', localized: true },
            { name: 'icon', type: 'text', admin: { description: 'Icon name (e.g. lucide icon id).' } },
            { name: 'image', type: 'upload', relationTo: 'media' },
            {
              name: 'products',
              type: 'join',
              collection: 'products',
              on: 'family',
              defaultSort: 'sortOrder',
            },
          ],
        },
      ],
    },
    slugField(),
    sortOrderField,
  ],
}
