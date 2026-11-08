import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta, opt } from './meta'

export const FAQ: Block = {
  slug: 'faq',
  interfaceName: 'FAQBlock',
  ...blockMeta('faq', ['SSS', 'FAQ'], ['SSS blokları', 'FAQs'], 'utility'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'collection',
      label: L('Kaynak', 'Source'),
      options: [
        opt('collection', 'SSS koleksiyonundan seç', 'Pick from FAQ collection'),
        opt('inline', 'Bu blokta yaz', 'Inline items'),
      ],
    },
    {
      name: 'faqs',
      type: 'relationship',
      relationTo: 'faqs',
      hasMany: true,
      label: L('Sorular', 'FAQs'),
      admin: { condition: (_, sibling) => sibling?.source === 'collection' },
    },
    {
      name: 'items',
      type: 'array',
      label: L('Sorular', 'Items'),
      labels: { singular: L('Soru', 'Item'), plural: L('Sorular', 'Items') },
      admin: { condition: (_, sibling) => sibling?.source === 'inline' },
      fields: [
        { name: 'question', type: 'text', localized: true, required: true, label: L('Soru', 'Question') },
        { name: 'answer', type: 'richText', localized: true, required: true, label: L('Yanıt', 'Answer') },
      ],
    },
    blockSettings('faq'),
    blockMotion('faq'),
  ],
}
