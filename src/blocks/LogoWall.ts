import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta, opt } from './meta'

export const LogoWall: Block = {
  slug: 'logoWall',
  interfaceName: 'LogoWallBlock',
  ...blockMeta('logoWall', ['Logo duvarı', 'Logo wall'], ['Logo duvarları', 'Logo walls'], 'proof'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      label: L('Kaynak', 'Source'),
      options: [
        opt('manual', 'Elle eklenen logolar', 'Manual logos'),
        opt('caseStudies', 'Referans müşterileri', 'Case study customers'),
        opt('partners', 'İş ortakları', 'Partners'),
      ],
    },
    {
      name: 'logos',
      type: 'array',
      label: L('Logolar', 'Logos'),
      labels: { singular: L('Logo', 'Logo'), plural: L('Logolar', 'Logos') },
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
      fields: [
        { name: 'logo', type: 'upload', relationTo: 'media', required: true, label: L('Logo', 'Logo') },
        { name: 'name', type: 'text', required: true, label: L('Ad', 'Name') },
        { name: 'url', type: 'text', label: L('Bağlantı', 'URL') },
      ],
    },
    {
      name: 'caseStudies',
      type: 'relationship',
      relationTo: 'case-studies',
      hasMany: true,
      label: L('Referanslar', 'Case studies'),
      admin: { condition: (_, sibling) => sibling?.source === 'caseStudies' },
    },
    {
      name: 'partners',
      type: 'relationship',
      relationTo: 'partners',
      hasMany: true,
      label: L('İş ortakları', 'Partners'),
      admin: { condition: (_, sibling) => sibling?.source === 'partners' },
    },
    blockSettings('logoWall'),
  ],
}
