import type { CollectionConfig } from 'payload'

import { isAdminOrEditor, publishedOrStaff } from '@/access'
import { draftVersions, publishedAtField } from '@/fields/common'
import { slugField } from '@/fields/slug'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'category', 'publishedAt', '_status'], group: 'Marketing' },
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
            { name: 'excerpt', type: 'textarea', localized: true },
            { name: 'coverImage', type: 'upload', relationTo: 'media' },
            { name: 'content', type: 'richText', localized: true },
          ],
        },
      ],
    },
    slugField(),
    {
      name: 'category',
      type: 'select',
      defaultValue: 'news',
      options: [
        { label: 'News', value: 'news' },
        { label: 'Product update', value: 'product-update' },
        { label: 'Event', value: 'event' },
        { label: 'Blog', value: 'blog' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar' },
      // Expose only the author id publicly; users collection itself is staff-only.
    },
    { name: 'products', type: 'relationship', relationTo: 'products', hasMany: true, admin: { position: 'sidebar' } },
    publishedAtField,
  ],
}
