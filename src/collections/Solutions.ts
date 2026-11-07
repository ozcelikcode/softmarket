import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, layoutField, publishedAtField, sortOrderField } from '@/fields/common'
import { slugField } from '@/fields/slug'

/** Use-case / scenario landing pages (sector-specific ones link `industries`). */
export const Solutions: CollectionConfig = {
  slug: 'solutions',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status'], group: 'Marketing' },
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
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'heroImage', type: 'upload', relationTo: 'media' },
            layoutField(),
          ],
        },
        {
          label: 'Related',
          fields: [
            { name: 'industries', type: 'relationship', relationTo: 'industries', hasMany: true },
            { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
            { name: 'caseStudies', type: 'relationship', relationTo: 'case-studies', hasMany: true },
          ],
        },
      ],
    },
    slugField(),
    sortOrderField,
    publishedAtField,
  ],
}
