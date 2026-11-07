import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { layoutField, sortOrderField } from '@/fields/common'
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
            layoutField({
              admin: {
                description: {
                  tr: 'Aile sayfasında ürün listesinin altında gösterilen bloklar (sürükle-bırak ile sıralanır).',
                  en: 'Blocks shown below the product list on the family page (drag to reorder).',
                },
              },
            }),
          ],
        },
      ],
    },
    slugField(),
    sortOrderField,
  ],
}
