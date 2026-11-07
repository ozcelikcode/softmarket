import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'

/** Enforces unique (product, version). */
const uniqueProductVersion: CollectionBeforeValidateHook = async ({ data, originalDoc, req, operation }) => {
  const product = data?.product ?? originalDoc?.product
  const version = data?.version ?? originalDoc?.version
  if (!product || !version) return data
  const productId = typeof product === 'object' ? product.id : product
  const { totalDocs } = await req.payload.count({
    collection: 'releases',
    where: {
      and: [
        { product: { equals: productId } },
        { version: { equals: version } },
        ...(operation === 'update' && originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    overrideAccess: true,
    req,
  })
  if (totalDocs > 0) {
    throw new ValidationError({
      collection: 'releases',
      errors: [{ path: 'version', message: 'This version already exists for the product.' }],
    })
  }
  return data
}

export const Releases: CollectionConfig = {
  slug: 'releases',
  admin: { useAsTitle: 'version', defaultColumns: ['product', 'version', 'channel', 'releaseDate'], group: 'Support' },
  defaultSort: '-releaseDate',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  hooks: { beforeValidate: [uniqueProductVersion] },
  fields: [
    { name: 'product', type: 'relationship', relationTo: 'products', required: true, index: true },
    {
      type: 'row',
      fields: [
        {
          name: 'version',
          type: 'text',
          required: true,
          index: true,
          admin: { description: 'Semantic version, e.g. 3.2.1' },
        },
        {
          name: 'channel',
          type: 'select',
          defaultValue: 'stable',
          options: [
            { label: 'Stable', value: 'stable' },
            { label: 'Beta', value: 'beta' },
            { label: 'LTS', value: 'lts' },
          ],
        },
        { name: 'releaseDate', type: 'date', required: true, index: true },
      ],
    },
    { name: 'title', type: 'text', localized: true },
    { name: 'notes', type: 'richText', localized: true },
    {
      name: 'changes',
      type: 'array',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'Improved', value: 'improved' },
            { label: 'Fixed', value: 'fixed' },
            { label: 'Security', value: 'security' },
            { label: 'Breaking', value: 'breaking' },
          ],
        },
        { name: 'description', type: 'text', localized: true, required: true },
      ],
    },
    { name: 'downloads', type: 'join', collection: 'downloads', on: 'release' },
  ],
}
