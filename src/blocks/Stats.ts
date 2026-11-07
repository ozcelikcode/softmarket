import type { Block } from 'payload'

export const Stats: Block = {
  slug: 'stats',
  interfaceName: 'StatsBlock',
  labels: { singular: 'Stats', plural: 'Stats' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: 'value', type: 'text', required: true, admin: { description: 'e.g. 500+, %99.9' } },
        { name: 'label', type: 'text', localized: true, required: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
  ],
}
