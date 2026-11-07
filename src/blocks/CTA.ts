import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'
import { linkField } from '@/fields/link'

import { L, blockMeta, opt } from './meta'

export const CTA: Block = {
  slug: 'cta',
  interfaceName: 'CTABlock',
  ...blockMeta('cta', ['Çağrı bandı', 'Call to action'], ['Çağrı bantları', 'Calls to action'], 'conversion'),
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'banner',
      label: L('Stil', 'Style'),
      options: [
        opt('banner', 'Bant (koyu, parıltılı)', 'Band (dark, glow)'),
        opt('card', 'Kart (ortalanmış)', 'Card (centered)'),
        opt('split', 'Yan yana (metin solda, butonlar sağda)', 'Split (text left, actions right)'),
      ],
    },
    { name: 'heading', type: 'text', localized: true, required: true, label: L('Başlık', 'Heading') },
    { name: 'body', type: 'textarea', localized: true, label: L('Metin', 'Body') },
    {
      name: 'actions',
      type: 'array',
      minRows: 1,
      maxRows: 2,
      label: L('Butonlar', 'Actions'),
      labels: { singular: L('Buton', 'Action'), plural: L('Butonlar', 'Actions') },
      fields: [linkField({ withAppearance: true })],
    },
    blockSettings('cta'),
  ],
}
