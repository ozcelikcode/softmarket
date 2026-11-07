import type { Block } from 'payload'

export const FeatureGrid: Block = {
  slug: 'featureGrid',
  interfaceName: 'FeatureGridBlock',
  labels: { singular: 'Feature Grid', plural: 'Feature Grids' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    { name: 'intro', type: 'textarea', localized: true },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: ['2', '3', '4'].map((v) => ({ label: v, value: v })),
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      fields: [
        { name: 'icon', type: 'text', admin: { description: 'Icon name (e.g. lucide icon id).' } },
        { name: 'image', type: 'upload', relationTo: 'media' },
        { name: 'title', type: 'text', localized: true, required: true },
        { name: 'description', type: 'textarea', localized: true },
      ],
    },
  ],
}
