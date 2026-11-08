import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta } from './meta'

export const Stats: Block = {
  slug: 'stats',
  interfaceName: 'StatsBlock',
  ...blockMeta('stats', ['Rakamlar', 'Stats'], ['Rakamlar', 'Stats'], 'proof'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      maxRows: 6,
      label: L('Rakamlar', 'Items'),
      labels: { singular: L('Rakam', 'Item'), plural: L('Rakamlar', 'Items') },
      fields: [
        { name: 'value', type: 'text', required: true, label: L('Değer', 'Value'), admin: { description: L('ör. 500+, %99,9', 'e.g. 500+, 99.9%') } },
        { name: 'label', type: 'text', localized: true, required: true, label: L('Etiket', 'Label') },
        { name: 'description', type: 'textarea', localized: true, label: L('Açıklama', 'Description') },
      ],
    },
    blockSettings('stats'),
    blockMotion('stats'),
  ],
}
