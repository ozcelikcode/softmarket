import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { listDisplayFields, listHeaderFields, viewAllFields } from './list-fields'
import { L, blockMeta, opt } from './meta'

export const NEWS_CATEGORIES = ['news', 'product-update', 'event', 'blog'] as const

export const NewsList: Block = {
  slug: 'newsList',
  interfaceName: 'NewsListBlock',
  ...blockMeta('newsList', ['Haber listesi', 'News list'], ['Haber listeleri', 'News lists'], 'content'),
  fields: [
    ...listHeaderFields(),
    {
      name: 'source',
      type: 'select',
      defaultValue: 'latest',
      label: L('Kaynak', 'Source'),
      options: [
        opt('latest', 'Son haberler', 'Latest posts'),
        opt('category', 'Kategoriye göre', 'By category'),
        opt('manual', 'Elle seçilen haberler', 'Selected posts'),
      ],
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'news',
      label: L('Kategori', 'Category'),
      options: [
        opt('news', 'Haber', 'News'),
        opt('product-update', 'Ürün güncellemesi', 'Product update'),
        opt('event', 'Etkinlik', 'Event'),
        opt('blog', 'Blog', 'Blog'),
      ],
      admin: { condition: (_, sibling) => sibling?.source === 'category' },
    },
    {
      name: 'posts',
      type: 'relationship',
      relationTo: 'posts',
      hasMany: true,
      maxDepth: 0,
      label: L('Haberler', 'Posts'),
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
    },
    ...listDisplayFields({ limit: 3, sort: 'newest', layout: 'grid-3' }),
    ...viewAllFields('/haberler'),
    blockSettings('newsList'),
  ],
}
