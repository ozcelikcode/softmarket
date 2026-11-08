import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import { publicImageFilter } from '@/fields/public-media'

import { L, blockMeta } from './meta'

export const Tabs: Block = {
  slug: 'tabs',
  interfaceName: 'TabsBlock',
  ...blockMeta('tabs', ['Sekmeler', 'Tabs'], ['Sekmeler', 'Tabs'], 'content'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'items',
      type: 'array',
      minRows: 2,
      maxRows: 6,
      label: L('Sekmeler', 'Tabs'),
      labels: { singular: L('Sekme', 'Tab'), plural: L('Sekmeler', 'Tabs') },
      fields: [
        { name: 'label', type: 'text', localized: true, required: true, label: L('Sekme adı', 'Tab label') },
        { name: 'content', type: 'richText', localized: true, label: L('İçerik', 'Content') },
        { name: 'media', type: 'upload', relationTo: 'media', filterOptions: publicImageFilter, label: L('Görsel (isteğe bağlı)', 'Image (optional)') },
      ],
    },
    blockSettings('tabs'),
    blockMotion('tabs'),
  ],
}
