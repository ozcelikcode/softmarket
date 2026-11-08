import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import { ICON_NAMES, normalizeIconName } from '@/lib/icon-names'

import { L, blockMeta, opt } from './meta'

export const FeatureGrid: Block = {
  slug: 'featureGrid',
  interfaceName: 'FeatureGridBlock',
  ...blockMeta('featureGrid', ['Özellik ızgarası', 'Feature grid'], ['Özellik ızgaraları', 'Feature grids'], 'content'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    { name: 'intro', type: 'textarea', localized: true, label: L('Giriş metni', 'Intro') },
    {
      type: 'row',
      fields: [
        {
          name: 'columns',
          type: 'select',
          defaultValue: '3',
          label: L('Sütun', 'Columns'),
          options: ['2', '3', '4'].map((v) => ({ label: v, value: v })),
          admin: { width: '50%' },
        },
        {
          name: 'style',
          type: 'select',
          defaultValue: 'cards',
          label: L('Stil', 'Style'),
          options: [opt('cards', 'Kartlar', 'Cards'), opt('plain', 'Sade (çerçevesiz)', 'Plain (no frame)')],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'items',
      type: 'array',
      minRows: 1,
      label: L('Özellikler', 'Items'),
      labels: { singular: L('Özellik', 'Item'), plural: L('Özellikler', 'Items') },
      fields: [
        {
          // Was free text before F3; the column stays text. Known spellings (e.g. `ShieldCheck`) are
          // normalized, unknown names are cleared on save (the renderer already showed a fallback icon).
          name: 'icon',
          type: 'select',
          label: L('İkon', 'Icon'),
          options: ICON_NAMES.map((name) => ({ label: name, value: name })),
          hooks: { beforeValidate: [({ value }) => (value == null || value === '' ? value : normalizeIconName(value))] },
          admin: { description: L('Görsel seçilirse ikon yerine görsel gösterilir.', 'An image, if set, replaces the icon.') },
        },
        { name: 'image', type: 'upload', relationTo: 'media', label: L('Görsel', 'Image') },
        { name: 'title', type: 'text', localized: true, required: true, label: L('Başlık', 'Title') },
        { name: 'description', type: 'textarea', localized: true, label: L('Açıklama', 'Description') },
      ],
    },
    blockSettings('featureGrid'),
    blockMotion('featureGrid'),
  ],
}
