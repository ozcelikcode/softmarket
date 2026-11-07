import type { Block } from 'payload'

export const RichText: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  labels: { singular: 'Rich Text', plural: 'Rich Text' },
  fields: [
    {
      name: 'width',
      type: 'select',
      defaultValue: 'normal',
      options: [
        { label: 'Narrow', value: 'narrow' },
        { label: 'Normal', value: 'normal' },
        { label: 'Wide', value: 'wide' },
      ],
    },
    { name: 'content', type: 'richText', localized: true, required: true },
  ],
}
