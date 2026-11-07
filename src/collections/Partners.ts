import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const Partners: CollectionConfig = {
  slug: 'partners',
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'tier', 'country'], group: 'Marketing' },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'website', type: 'text' },
    {
      name: 'tier',
      type: 'select',
      defaultValue: 'reseller',
      options: [
        { label: 'Technology', value: 'technology' },
        { label: 'Solution', value: 'solution' },
        { label: 'Reseller', value: 'reseller' },
        { label: 'Distributor', value: 'distributor' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'country', type: 'text' },
        { name: 'city', type: 'text' },
      ],
    },
    { name: 'description', type: 'textarea', localized: true },
    slugField({ source: 'name' }),
    sortOrderField,
  ],
}
