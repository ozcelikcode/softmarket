import type { Block } from 'payload'

export const FAQ: Block = {
  slug: 'faq',
  interfaceName: 'FAQBlock',
  labels: { singular: 'FAQ', plural: 'FAQs' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'collection',
      options: [
        { label: 'Pick from FAQ collection', value: 'collection' },
        { label: 'Inline items', value: 'inline' },
      ],
    },
    {
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
      admin: { condition: (_, sibling) => sibling?.source === 'collection' },
    },
    {
      name: 'items',
      type: 'array',
      admin: { condition: (_, sibling) => sibling?.source === 'inline' },
      fields: [
        { name: 'question', type: 'text', localized: true, required: true },
        { name: 'answer', type: 'richText', localized: true, required: true },
      ],
    },
  ],
}
