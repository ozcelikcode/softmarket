import type { Field } from 'payload'

import { L, opt } from './meta'

/**
 * Shared option sets and field groups for list blocks (productFamilies, productShowcase, solutionsGrid,
 * newsList, logoWall limit). "The list is a movable block" (plan decisions): source, limit, sort, layout,
 * heading copy and a "view all" link are configured per block. Stored values are stable; only add options.
 */

export const LIST_SORTS = ['order', 'newest', 'oldest', 'manual'] as const
export const LIST_LAYOUTS = ['grid-3', 'grid-2', 'grid-4', 'list'] as const
export const MAX_LIST_LIMIT = 24

export type ListSort = (typeof LIST_SORTS)[number]
export type ListLayout = (typeof LIST_LAYOUTS)[number]

const SORT_LABELS: Record<ListSort, [string, string]> = {
  order: ['Sıra alanına göre', 'By order field'],
  newest: ['Yeniden eskiye', 'Newest first'],
  oldest: ['Eskiden yeniye', 'Oldest first'],
  manual: ['Elle seçim sırası', 'Manual selection order'],
}

/** Eyebrow, heading and description (localized). */
export const listHeaderFields = (): Field[] => [
  { name: 'eyebrow', type: 'text', localized: true, label: L('Üst başlık (eyebrow)', 'Eyebrow') },
  { name: 'heading', type: 'text', localized: true, label: L('Başlık', 'Heading') },
  { name: 'description', type: 'textarea', localized: true, label: L('Açıklama', 'Description') },
]

/** Limit, sort and layout. `layouts` may add block-specific values after the shared ones. */
export function listDisplayFields(opts: { limit: number; sort: ListSort; layout: ListLayout; extraLayouts?: [value: string, tr: string, en: string][] }): Field[] {
  return [
    {
      type: 'row',
      fields: [
        {
          name: 'limit',
          type: 'number',
          defaultValue: opts.limit,
          min: 1,
          max: MAX_LIST_LIMIT,
          label: L('En çok kaç kayıt', 'Max items'),
          admin: { width: '33%', step: 1, description: L(`1-${MAX_LIST_LIMIT} arası.`, `Between 1 and ${MAX_LIST_LIMIT}.`) },
        },
        {
          name: 'sort',
          type: 'select',
          defaultValue: opts.sort,
          label: L('Sıralama', 'Sort'),
          options: LIST_SORTS.map((v) => opt(v, ...SORT_LABELS[v])),
          admin: { width: '33%', description: L('"Elle seçim sırası" yalnız elle seçilen kaynakta geçerlidir.', '"Manual selection order" only applies to a manual source.') },
        },
        {
          name: 'layout',
          type: 'select',
          defaultValue: opts.layout,
          label: L('Düzen', 'Layout'),
          options: [
            opt('grid-3', 'Izgara (3 sütun)', 'Grid (3 columns)'),
            opt('grid-2', 'Izgara (2 sütun)', 'Grid (2 columns)'),
            opt('grid-4', 'Izgara (4 sütun)', 'Grid (4 columns)'),
            opt('list', 'Liste', 'List'),
            ...(opts.extraLayouts ?? []).map(([v, tr, en]) => opt(v, tr, en)),
          ],
          admin: { width: '33%' },
        },
      ],
    },
  ]
}

/** "View all" link under the heading: label (localized) and target path/URL, both optional. */
export const viewAllFields = (defaultPath: string): Field[] => [
  {
    type: 'row',
    fields: [
      { name: 'showViewAll', type: 'checkbox', defaultValue: true, label: L('"Tümünü gör" bağlantısı', '"View all" link'), admin: { width: '25%' } },
      {
        name: 'viewAllLabel',
        type: 'text',
        localized: true,
        label: L('Bağlantı metni', 'Link label'),
        admin: { width: '35%', condition: (_, sibling) => sibling?.showViewAll !== false, description: L('Boşsa "Tümünü gör".', 'Empty uses "View all".') },
      },
      {
        name: 'viewAllUrl',
        type: 'text',
        label: L('Bağlantı adresi', 'Link URL'),
        admin: { width: '40%', condition: (_, sibling) => sibling?.showViewAll !== false, description: L(`Boşsa ${defaultPath}. Site içi yol (/...) veya https adresi.`, `Empty uses ${defaultPath}. Internal path (/...) or https URL.`) },
      },
    ],
  },
]
