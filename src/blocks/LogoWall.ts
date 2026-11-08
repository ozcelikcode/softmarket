import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
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
        opt('allPartners', 'Tüm iş ortakları (otomatik)', 'All partners (automatic)'),
        opt('allCaseStudies', 'Tüm referans müşterileri (otomatik)', 'All case study customers (automatic)'),
        opt('partnersAndCaseStudies', 'İş ortakları + referanslar (otomatik)', 'Partners + case study customers (automatic)'),
      ],
    },
    {
      name: 'limit',
      type: 'number',
      defaultValue: 12,
      min: 1,
      max: 24,
      label: L('En çok kaç logo', 'Max logos'),
      admin: {
        step: 1,
        condition: (_, sibling) => ['allPartners', 'allCaseStudies', 'partnersAndCaseStudies'].includes(sibling?.source),
        description: L('Yalnız otomatik kaynaklarda geçerli.', 'Only applies to automatic sources.'),
      },
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
      maxDepth: 0,
      label: L('Referanslar', 'Case studies'),
      admin: { condition: (_, sibling) => sibling?.source === 'caseStudies' },
    },
    {
      name: 'partners',
      type: 'relationship',
      relationTo: 'partners',
      hasMany: true,
      maxDepth: 0,
      label: L('İş ortakları', 'Partners'),
      admin: { condition: (_, sibling) => sibling?.source === 'partners' },
    },
    blockSettings('logoWall'),
    blockMotion('logoWall'),
  ],
}
