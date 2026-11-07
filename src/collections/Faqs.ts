import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { slugField } from '@/fields/slug'
import { sortOrderField } from '@/fields/common'

export const Faqs: CollectionConfig = {
  slug: 'faqs',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  admin: { useAsTitle: 'question', defaultColumns: ['question', 'category', 'product'], group: 'Support' },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    slugField({ source: 'question' }),
    { name: 'question', type: 'text', localized: true, required: true },
    { name: 'answer', type: 'richText', localized: true, required: true },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'general',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Licensing', value: 'licensing' },
        { label: 'Billing', value: 'billing' },
        { label: 'Technical', value: 'technical' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'product', type: 'relationship', relationTo: 'products', admin: { position: 'sidebar' } },
    sortOrderField,
  ],
}
