import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, layoutField, publishedAtField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const CaseStudies: CollectionConfig = {
  slug: 'case-studies',
  labels: { singular: 'Case Study', plural: 'Case Studies' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'customerName', '_status'], group: 'Marketing' },
  defaultSort: '-publishedAt',
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
            { name: 'customerName', type: 'text', required: true },
            { name: 'customerLogo', type: 'upload', relationTo: 'media' },
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'challenge', type: 'richText', localized: true },
            { name: 'solution', type: 'richText', localized: true },
            {
              name: 'results',
              type: 'array',
              fields: [
                { name: 'value', type: 'text', required: true },
                { name: 'label', type: 'text', localized: true, required: true },
              ],
            },
            {
              name: 'testimonial',
              type: 'group',
              fields: [
                { name: 'quote', type: 'textarea', localized: true },
                { name: 'author', type: 'text' },
                { name: 'role', type: 'text', localized: true },
              ],
            },
            layoutField(),
          ],
        },
        {
          label: 'Related',
          fields: [
            { name: 'industry', type: 'relationship', relationTo: 'industries' },
            { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true },
          ],
        },
      ],
    },
    slugField(),
    { name: 'featured', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
    publishedAtField,
  ],
}
