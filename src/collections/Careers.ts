import type { CollectionConfig, Where } from 'payload'

import { isAdminOrEditor, isAdminOrEditorUser } from '@/access'
import { publishedAtField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const Careers: CollectionConfig = {
  slug: 'careers',
  labels: { singular: 'Job Opening', plural: 'Careers' },
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'department', 'location', 'isOpen'], group: 'Marketing' },
  defaultSort: '-publishedAt',
  access: {
    // Public sees only open positions.
    read: ({ req: { user } }) =>
      isAdminOrEditorUser(user) ? true : ({ isOpen: { equals: true } } satisfies Where),
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
            {
              type: 'row',
              fields: [
                { name: 'department', type: 'text', localized: true },
                { name: 'location', type: 'text', localized: true },
              ],
            },
            {
              name: 'employmentType',
              type: 'select',
              defaultValue: 'full-time',
              options: [
                { label: 'Full-time', value: 'full-time' },
                { label: 'Part-time', value: 'part-time' },
                { label: 'Contract', value: 'contract' },
                { label: 'Internship', value: 'internship' },
              ],
            },
            {
              name: 'workMode',
              type: 'select',
              defaultValue: 'onsite',
              options: [
                { label: 'On-site', value: 'onsite' },
                { label: 'Hybrid', value: 'hybrid' },
                { label: 'Remote', value: 'remote' },
              ],
            },
            { name: 'summary', type: 'textarea', localized: true },
            { name: 'description', type: 'richText', localized: true },
            {
              name: 'applicationForm',
              type: 'relationship',
              relationTo: 'forms',
              admin: { description: 'Form-builder form used for applications.' },
            },
          ],
        },
      ],
    },
    slugField(),
    { name: 'isOpen', type: 'checkbox', defaultValue: true, index: true, admin: { position: 'sidebar' } },
    publishedAtField,
  ],
}
