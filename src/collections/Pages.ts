import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, layoutField, publishedAtField } from '@/fields/common'
import { slugField } from '@/fields/slug'

/** Free-form block pages (home, about, legal texts, landing pages). */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', '_status', 'updatedAt'], group: 'Content' },
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
            layoutField(),
          ],
        },
      ],
    },
    slugField({
      overrides: {
        admin: {
          position: 'sidebar',
          description: 'Use "home" for the homepage. Generated from title when empty.',
        },
      },
    }),
    {
      name: 'pageType',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Legal', value: 'legal' },
        { label: 'Landing', value: 'landing' },
      ],
      admin: { position: 'sidebar' },
    },
    publishedAtField,
  ],
}
