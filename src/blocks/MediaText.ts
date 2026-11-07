import type { Block } from 'payload'

import { linkField } from '@/fields/link'

export const MediaText: Block = {
  slug: 'mediaText',
  interfaceName: 'MediaTextBlock',
  labels: { singular: 'Media + Text', plural: 'Media + Text' },
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'mediaPosition',
      type: 'select',
      defaultValue: 'left',
      options: [
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
    { name: 'heading', type: 'text', localized: true },
    { name: 'body', type: 'richText', localized: true },
    {
      name: 'actions',
      type: 'array',
      maxRows: 2,
      fields: [linkField({ withAppearance: true })],
    },
  ],
}
