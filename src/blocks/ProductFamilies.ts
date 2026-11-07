import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { listDisplayFields, listHeaderFields, viewAllFields } from './list-fields'
import { L, blockMeta, opt } from './meta'

export const ProductFamilies: Block = {
  slug: 'productFamilies',
  interfaceName: 'ProductFamiliesBlock',
  ...blockMeta('productFamilies', ['Ürün aileleri vitrini', 'Product families'], ['Ürün aileleri vitrinleri', 'Product family showcases'], 'catalog'),
  fields: [
    ...listHeaderFields(),
    {
      name: 'source',
      type: 'select',
      defaultValue: 'all',
      label: L('Kaynak', 'Source'),
      options: [opt('all', 'Tüm aileler', 'All families'), opt('manual', 'Elle seçilen aileler', 'Selected families')],
    },
    {
      name: 'families',
      type: 'relationship',
      relationTo: 'product-families',
      hasMany: true,
      maxDepth: 0,
      label: L('Aileler', 'Families'),
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
    },
    { name: 'showCount', type: 'checkbox', defaultValue: true, label: L('Ürün sayısını göster', 'Show product count') },
    ...listDisplayFields({ limit: 6, sort: 'order', layout: 'grid-3' }),
    ...viewAllFields('/urunler'),
    blockSettings('productFamilies'),
  ],
}
