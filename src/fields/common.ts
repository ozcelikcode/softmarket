import type { BlocksField, CollectionConfig, DateField, NumberField } from 'payload'

import { layoutBlocks, pageBlocks } from '@/blocks'

/** Block-based body shared by pages, products, solutions and case studies. */
export const layoutField = (overrides: Partial<BlocksField> = {}): BlocksField => ({
  name: 'layout',
  type: 'blocks',
  blocks: layoutBlocks,
  ...overrides,
})

/** Pages: the full set plus the system-page `listing` block (F6). */
export const pageLayoutField = (overrides: Partial<BlocksField> = {}): BlocksField => layoutField({ blocks: pageBlocks, ...overrides })

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
