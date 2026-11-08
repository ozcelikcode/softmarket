import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta, opt } from './meta'

export const RichText: Block = {
  slug: 'richText',
  interfaceName: 'RichTextBlock',
  ...blockMeta('richText', ['Zengin metin', 'Rich text'], ['Zengin metinler', 'Rich text'], 'content'),
  fields: [
    {
      // Text measure. Predates F3, so this block's appearance group has no separate width option.
      name: 'width',
      type: 'select',
      defaultValue: 'normal',
      label: L('Metin genişliği', 'Text width'),
      options: [opt('narrow', 'Dar', 'Narrow'), opt('normal', 'Normal', 'Normal'), opt('wide', 'Geniş', 'Wide')],
    },
    { name: 'content', type: 'richText', localized: true, required: true, label: L('İçerik', 'Content') },
    blockSettings('richText'),
    blockMotion('richText'),
  ],
}
