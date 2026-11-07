import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { blockMeta, L, opt } from './meta'

export const SPACER_SIZES = ['sm', 'md', 'lg', 'xl'] as const

export const Spacer: Block = {
  slug: 'spacer',
  interfaceName: 'SpacerBlock',
  ...blockMeta('spacer', ['Boşluk', 'Spacer'], ['Boşluklar', 'Spacers'], 'utility'),
  fields: [
    {
      name: 'size',
      type: 'select',
      defaultValue: 'md',
      label: L('Yükseklik', 'Height'),
      options: [opt('sm', 'Küçük', 'Small'), opt('md', 'Orta', 'Medium'), opt('lg', 'Büyük', 'Large'), opt('xl', 'Çok büyük', 'Extra large')],
      admin: { description: L('Bloklar arasına boş alan ekler. Arka plan rengi için Görünüm > Tema kullanın.', 'Adds empty space between blocks. Use Appearance > Theme for the background color.') },
    },
    blockSettings('spacer'),
  ],
}
