import type { CollectionConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { sortOrderField } from '@/fields/common'

export const LICENSE_TYPES = ['perpetual', 'subscription'] as const
export type LicenseType = (typeof LICENSE_TYPES)[number]

/** Product edition identified by a stable code for quote requests and license assignment. */
export const Editions: CollectionConfig = {
  slug: 'editions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'product', 'sku', 'licenseType'],
    group: 'Catalog',
  },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Stable identifier used in quote requests and license assignment (e.g. ERP-PRO-1Y).' },
      validate: (value: string | null | undefined) =>
        value && /^[A-Z0-9][A-Z0-9-]{1,63}$/.test(value) ? true : 'Use A-Z, 0-9 and "-" (2-64 chars).',
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [{ name: 'text', type: 'text', localized: true, required: true }],
    },
    {
      name: 'licenseType',
      type: 'select',
      required: true,
      defaultValue: 'perpetual',
      options: [
        { label: 'Perpetual', value: 'perpetual' },
        { label: 'Subscription', value: 'subscription' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'durationMonths',
      type: 'number',
      min: 1,
      admin: {
        position: 'sidebar',
        condition: (_, sibling) => sibling?.licenseType === 'subscription',
      },
      validate: (
        value: number | null | undefined,
        { siblingData }: { siblingData: Partial<Record<string, unknown>> },
      ) =>
        siblingData?.licenseType !== 'subscription' || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1)
          ? true
          : 'Subscription editions need a duration (months).',
    },
    {
      name: 'seats',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: { position: 'sidebar' },
    },
    sortOrderField,
  ],
}
