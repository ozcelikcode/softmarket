import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { blockMeta, L, opt } from './meta'

export const DIVIDER_STYLES = ['line', 'accent'] as const

export const Divider: Block = {
  slug: 'divider',
  interfaceName: 'DividerBlock',
  ...blockMeta('divider', ['Ayraç', 'Divider'], ['Ayraçlar', 'Dividers'], 'utility'),
  fields: [
    {
      name: 'style',
      type: 'select',
      defaultValue: 'line',
      label: L('Stil', 'Style'),
      options: [opt('line', 'İnce çizgi', 'Thin line'), opt('accent', 'Vurgu rengi (ortada kısa çizgi)', 'Accent (short centered rule)')],
    },
    blockSettings('divider'),
  ],
}
