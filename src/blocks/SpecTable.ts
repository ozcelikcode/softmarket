import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { L, blockMeta } from './meta'

export const SpecTable: Block = {
  slug: 'specTable',
  interfaceName: 'SpecTableBlock',
  ...blockMeta('specTable', ['Teknik tablo', 'Spec table'], ['Teknik tablolar', 'Spec tables'], 'catalog'),
  fields: [
    { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
    {
      name: 'groups',
      type: 'array',
      minRows: 1,
      label: L('Gruplar', 'Groups'),
      labels: { singular: L('Grup', 'Group'), plural: L('Gruplar', 'Groups') },
      fields: [
        { name: 'title', type: 'text', localized: true, label: L('Grup başlığı', 'Group title') },
        {
          name: 'rows',
          type: 'array',
          minRows: 1,
          label: L('Satırlar', 'Rows'),
          labels: { singular: L('Satır', 'Row'), plural: L('Satırlar', 'Rows') },
          fields: [
            { name: 'label', type: 'text', localized: true, required: true, label: L('Özellik', 'Label') },
            { name: 'value', type: 'text', localized: true, required: true, label: L('Değer', 'Value') },
          ],
        },
      ],
    },
    blockSettings('specTable'),
  ],
}
