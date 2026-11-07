import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { listDisplayFields, listHeaderFields, viewAllFields } from './list-fields'
import { L, blockMeta, opt } from './meta'

export const SolutionsGrid: Block = {
  slug: 'solutionsGrid',
  interfaceName: 'SolutionsGridBlock',
  ...blockMeta('solutionsGrid', ['Çözümler', 'Solutions'], ['Çözüm ızgaraları', 'Solution grids'], 'catalog'),
  fields: [
    ...listHeaderFields(),
    {
      name: 'source',
      type: 'select',
      defaultValue: 'all',
      label: L('Kaynak', 'Source'),
      options: [
        opt('all', 'Tüm çözümler', 'All solutions'),
        opt('manual', 'Elle seçilen çözümler', 'Selected solutions'),
        opt('byIndustry', 'Sektöre göre', 'By industry'),
      ],
    },
    {
      name: 'solutions',
      type: 'relationship',
      relationTo: 'solutions',
      hasMany: true,
      maxDepth: 0,
      label: L('Çözümler', 'Solutions'),
      admin: { condition: (_, sibling) => sibling?.source === 'manual' },
    },
    {
      name: 'industry',
      type: 'relationship',
      relationTo: 'industries',
      maxDepth: 0,
      label: L('Sektör', 'Industry'),
      admin: { condition: (_, sibling) => sibling?.source === 'byIndustry' },
    },
    ...listDisplayFields({ limit: 4, sort: 'order', layout: 'grid-4' }),
    ...viewAllFields('/cozumler'),
    blockSettings('solutionsGrid'),
  ],
}
