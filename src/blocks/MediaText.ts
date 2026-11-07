import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'
import { linkField } from '@/fields/link'

import { L, blockMeta, opt } from './meta'

export const MediaText: Block = {
  slug: 'mediaText',
  interfaceName: 'MediaTextBlock',
  ...blockMeta('mediaText', ['Medya + metin', 'Media + text'], ['Medya + metin', 'Media + text'], 'content'),
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true, label: L('Görsel', 'Media') },
    {
      name: 'mediaPosition',
      type: 'select',
      defaultValue: 'left',
      label: L('Görsel konumu', 'Media position'),
      options: [opt('left', 'Solda', 'Left'), opt('right', 'Sağda', 'Right')],
    },
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    { name: 'body', type: 'richText', localized: true, label: L('Metin', 'Body') },
    {
      name: 'actions',
      type: 'array',
      maxRows: 2,
      label: L('Butonlar', 'Actions'),
      labels: { singular: L('Buton', 'Action'), plural: L('Butonlar', 'Actions') },
      fields: [linkField({ withAppearance: true })],
    },
    blockSettings('mediaText'),
  ],
}
