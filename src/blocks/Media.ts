import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import { publicImageFilter } from '@/fields/public-media'

import { L, blockMeta, opt } from './meta'

/** Stored values; renderer maps them to Tailwind aspect classes (lib/blocks/static.ts). */
export const MEDIA_ASPECTS = ['auto', '16-9', '4-3', '1-1', '21-9'] as const

export const Media: Block = {
  slug: 'media',
  interfaceName: 'MediaBlock',
  ...blockMeta('media', ['Görsel / figür', 'Media / figure'], ['Görseller / figürler', 'Media / figures'], 'content'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      maxRows: 4,
      label: L('Görseller', 'Images'),
      labels: { singular: L('Görsel', 'Image'), plural: L('Görseller', 'Images') },
      admin: { description: L('1 görsel tam genişlikte, 2-4 görsel ızgarada gösterilir.', '1 image renders full width, 2-4 render as a grid.') },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true, filterOptions: publicImageFilter, label: L('Görsel', 'Image') },
        { name: 'caption', type: 'text', localized: true, label: L('Alt yazı', 'Caption') },
      ],
    },
    {
      name: 'aspect',
      type: 'select',
      defaultValue: 'auto',
      label: L('En-boy oranı', 'Aspect ratio'),
      options: [
        opt('auto', 'Özgün oran', 'Original ratio'),
        opt('16-9', '16:9', '16:9'),
        opt('4-3', '4:3', '4:3'),
        opt('1-1', 'Kare (1:1)', 'Square (1:1)'),
        opt('21-9', 'Geniş (21:9)', 'Ultrawide (21:9)'),
      ],
      admin: { description: L('Seçilen oran görseli kırparak doldurur; "Özgün oran" kırpmaz.', 'A fixed ratio crops the image to fill; "Original ratio" never crops.') },
    },
    blockSettings('media'),
    blockMotion('media'),
  ],
}
