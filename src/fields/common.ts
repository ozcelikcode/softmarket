import type { BlocksField, CollectionConfig, DateField, NumberField } from 'payload'

import { layoutBlocks } from '@/blocks'

/** Block-based body shared by pages, products, solutions and case studies. */
export const layoutField = (overrides: Partial<BlocksField> = {}): BlocksField => ({
  name: 'layout',
  type: 'blocks',
  blocks: layoutBlocks,
  ...overrides,
})

/** Sidebar date auto-filled on first publish. */
export const publishedAtField: DateField = {
  name: 'publishedAt',
  type: 'date',
  index: true,
  admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
  hooks: {
    beforeChange: [
      ({ value, siblingData }) => {
        if (!value && siblingData?._status === 'published') return new Date().toISOString()
        return value
      },
    ],
  },
}

export const sortOrderField: NumberField = {
  name: 'sortOrder',
  type: 'number',
  defaultValue: 0,
  index: true,
  admin: { position: 'sidebar' },
}

/** Standard drafts + versions setup for editorial collections. */
export const draftVersions: CollectionConfig['versions'] = {
  drafts: { autosave: false },
  maxPerDoc: 50,
}
