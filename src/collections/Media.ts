import type { CollectionConfig } from 'payload'
import path from 'path'

import { isAdminField, isAdminOrEditor, isAdminOrEditorField, mediaRead } from '@/access'

/**
 * Single upload collection for images and downloadable binaries.
 * Uploads start protected and require an authorizing download or explicit licensedProducts.
 * Public content images must opt out of protection at creation. Once protected, a file
 * cannot become an unreferenced public upload again (also enforced in the database).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
    defaultColumns: ['filename', 'alt', 'visibility', 'updatedAt'],
  },
  access: {
    read: mediaRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    {
      name: 'seedPath', type: 'text', unique: true,
      admin: { readOnly: true, description: 'Stable content import path; managed by content:import.' },
      access: { create: isAdminField, update: isAdminField },
    },
    {
      name: 'alt',
      type: 'text',
      required: true,
      localized: true,
    },
    { name: 'caption', type: 'text', localized: true },
    {
      name: 'protected',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Required for downloads. Permanent once enabled; disable at upload only for public content images.',
      },
      hooks: { beforeChange: [({ value, originalDoc }) => originalDoc?.protected === true ? true : value] },
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'public',
      index: true,
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Licensed customers only', value: 'licensed' },
      ],
      access: { update: isAdminOrEditorField },
      admin: { position: 'sidebar' },
    },
    {
      name: 'licensedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      admin: {
        position: 'sidebar',
        condition: (data) => data?.visibility === 'licensed',
        description: 'Customers with a valid license for any of these products can access the file.',
      },
    },
  ],
  upload: {
    staticDir: process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),
  },
}
