import type { Block } from 'payload'

export const SpecTable: Block = {
  slug: 'specTable',
  interfaceName: 'SpecTableBlock',
  labels: { singular: 'Spec Table', plural: 'Spec Tables' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    {
      name: 'groups',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'title', type: 'text', localized: true },
        {
          name: 'rows',
          type: 'array',
          minRows: 1,
          fields: [
            { name: 'label', type: 'text', localized: true, required: true },
            { name: 'value', type: 'text', localized: true, required: true },
          ],
        },
      ],
    },
  ],
}
