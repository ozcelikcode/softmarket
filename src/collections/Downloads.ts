import type { CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { downloadsRead, isAdminOrEditor } from '@/access'
import { OPERATING_SYSTEMS } from './Products'

export const Downloads: CollectionConfig = {
  slug: 'downloads',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'product', 'release', 'os', 'access'], group: 'Support' },
  access: {
    read: downloadsRead,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: {
    beforeChange: [async ({ data, originalDoc, req }) => {
      const file = data.file ?? originalDoc?.file
      const id = typeof file === 'object' && file ? file.id : file
      const media = await req.payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true, req })
      if (!media.protected) {
        throw new ValidationError({ collection: 'downloads', errors: [{ path: 'file', message: 'Protect the media before attaching it to a download.' }] })
      }
      return data
    }],
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    { name: 'description', type: 'textarea', localized: true },
    { name: 'file', type: 'upload', relationTo: 'media', required: true },
    {
      type: 'row',
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
        {
          name: 'release',
          type: 'relationship',
          relationTo: 'releases',
          index: true,
          filterOptions: ({ siblingData }) => {
            const data = siblingData as { product?: number | { id: number } } | undefined
            const product = typeof data?.product === 'object' ? data.product.id : data?.product
            return product ? { product: { equals: product } } : true
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'os', type: 'select', options: OPERATING_SYSTEMS, required: true, index: true },
        {
          name: 'arch',
          type: 'select',
          options: [
            { label: 'x64', value: 'x64' },
            { label: 'arm64', value: 'arm64' },
            { label: 'x86', value: 'x86' },
            { label: 'Universal', value: 'universal' },
          ],
        },
        {
          name: 'access',
          type: 'select',
          required: true,
          defaultValue: 'licensed',
          index: true,
          options: [
            { label: 'Public', value: 'public' },
            { label: 'Licensed customers', value: 'licensed' },
          ],
        },
      ],
    },
    {
      name: 'checksumSha256',
      type: 'text',
      validate: (value: string | null | undefined) =>
        !value || /^[a-f0-9]{64}$/i.test(value) ? true : 'Must be a 64-char hex SHA-256.',
    },
  ],
}
