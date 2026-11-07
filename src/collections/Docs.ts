import type { CollectionConfig, Where } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

/** Product documentation. URL: /destek/dokumantasyon/[product]/[slug] — slug unique per product+locale. */
export const Docs: CollectionConfig = {
  slug: 'docs',
  labels: { singular: 'Doc', plural: 'Docs' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'product', 'parent', 'sortOrder', '_status'], group: 'Support' },
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
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', localized: true, required: true },
            { name: 'excerpt', type: 'textarea', localized: true },
            { name: 'content', type: 'richText', localized: true },
          ],
        },
      ],
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    slugField({ scope: 'product' }),
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'docs',
      admin: { position: 'sidebar', description: 'Optional parent for nested navigation.' },
      filterOptions: ({ id, data }) => {
        const product = data?.product && typeof data.product === 'object' ? data.product.id : data?.product
        const and: Where[] = []
        if (id) and.push({ id: { not_equals: id } })
        if (product) and.push({ product: { equals: product } })
        return and.length > 0 ? { and } : true
      },
    },
    { name: 'appliesToVersions', type: 'text', admin: { position: 'sidebar', description: 'e.g. ">=3.0"' } },
    sortOrderField,
  ],
}
