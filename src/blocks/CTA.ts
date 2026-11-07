import type { Block } from 'payload'

import { linkField } from '@/fields/link'

export const CTA: Block = {
  slug: 'cta',
  interfaceName: 'CTABlock',
  labels: { singular: 'Call to Action', plural: 'Calls to Action' },
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'banner',
      options: [
        { label: 'Banner', value: 'banner' },
        { label: 'Card', value: 'card' },
      ],
    },
    { name: 'heading', type: 'text', localized: true, required: true },
    { name: 'body', type: 'textarea', localized: true },
    {
      name: 'actions',
      type: 'array',
      minRows: 1,
      maxRows: 2,
      fields: [linkField({ withAppearance: true })],
    },
  ],
}
