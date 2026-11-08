import type { Block } from 'payload'

import { blockMotion } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'

import { listDisplayFields, listHeaderFields, viewAllFields } from './list-fields'
import { L, blockMeta, opt } from './meta'

export const ProductShowcase: Block = {
  slug: 'productShowcase',
  interfaceName: 'ProductShowcaseBlock',
  ...blockMeta('productShowcase', ['Ürün vitrini', 'Product showcase'], ['Ürün vitrinleri', 'Product showcases'], 'catalog'),
  fields: [
    ...listHeaderFields(),
    {
      name: 'source',
      type: 'select',
      defaultValue: 'featured',
      label: L('Kaynak', 'Source'),
      options: [
        opt('featured', 'Öne çıkan ürünler', 'Featured products'),
        opt('all', 'Tüm ürünler', 'All products'),
        opt('manual', 'Elle seçilen ürünler', 'Selected products'),
        opt('byFamily', 'Aileye göre', 'By family'),
        opt('byIndustry', 'Sektöre göre', 'By industry'),
      ],
    },
    {
      name: 'products',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      maxDepth: 0,
      label: L('Ürünler', 'Products'),
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
    },
    {
      name: 'family',
      type: 'relationship',
      relationTo: 'product-families',
      maxDepth: 0,
      label: L('Ürün ailesi', 'Product family'),
      admin: { condition: (_, sibling) => sibling?.source === 'byFamily' },
    },
    {
      name: 'industry',
      type: 'relationship',
      relationTo: 'industries',
      maxDepth: 0,
      label: L('Sektör', 'Industry'),
      admin: { condition: (_, sibling) => sibling?.source === 'byIndustry' },
    },
    ...listDisplayFields({
      limit: 6,
      sort: 'order',
      layout: 'grid-3',
      extraLayouts: [['alternating', 'Dönüşümlü (görsel + metin)', 'Alternating (image + text)']],
    }),
    ...viewAllFields('/urunler'),
    blockSettings('productShowcase'),
    blockMotion('productShowcase'),
  ],
}
