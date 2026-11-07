import type { Block } from 'payload'

export const LogoWall: Block = {
  slug: 'logoWall',
  interfaceName: 'LogoWallBlock',
  labels: { singular: 'Logo Wall', plural: 'Logo Walls' },
  fields: [
    { name: 'heading', type: 'text', localized: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual logos', value: 'manual' },
        { label: 'Case study customers', value: 'caseStudies' },
        { label: 'Partners', value: 'partners' },
      ],
    },
    {
      name: 'logos',
      type: 'array',
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
      fields: [
        { name: 'logo', type: 'upload', relationTo: 'media', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'url', type: 'text' },
      ],
    },
    {
      name: 'caseStudies',
      type: 'relationship',
      relationTo: 'case-studies',
      hasMany: true,
      admin: { condition: (_, sibling) => sibling?.source === 'caseStudies' },
    },
    {
      name: 'partners',
      type: 'relationship',
      relationTo: 'partners',
      hasMany: true,
      admin: { condition: (_, sibling) => sibling?.source === 'partners' },
    },
  ],
}
