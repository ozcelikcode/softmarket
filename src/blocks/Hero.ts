import type { Block } from 'payload'

import { linkField } from '@/fields/link'

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Centered', value: 'centered' },
        { label: 'Split (media right)', value: 'split' },
      ],
    },
    { name: 'eyebrow', type: 'text', localized: true },
    { name: 'heading', type: 'text', localized: true, required: true },
    { name: 'subheading', type: 'textarea', localized: true },
    { name: 'media', type: 'upload', relationTo: 'media' },
    {
      name: 'actions',
      type: 'array',
      maxRows: 2,
      fields: [linkField({ withAppearance: true })],
    },
  ],
}
