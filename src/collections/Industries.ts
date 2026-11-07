import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const Industries: CollectionConfig = {
  slug: 'industries',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug'], group: 'Marketing' },
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
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'description', type: 'richText', localized: true },
            { name: 'icon', type: 'text' },
            { name: 'image', type: 'upload', relationTo: 'media' },
          ],
        },
      ],
    },
    slugField(),
    sortOrderField,
  ],
}
