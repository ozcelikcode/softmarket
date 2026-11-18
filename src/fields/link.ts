import type { CollectionSlug, GroupField } from 'payload'

import { ROUTE_PARAM_PATTERN, routeHasParam, routeOptions } from '@/i18n/paths'

/** Collections that internal links may point to. */
export const LINKABLE_COLLECTIONS: CollectionSlug[] = [
  'pages',
  'products',
  'product-families',
  'solutions',
  'industries',
  'case-studies',
  'posts',
  'careers',
  'docs',
]

type LinkOptions = {
  name?: string
  label?: string
  /** Whether the visible label is required. */
  withLabel?: boolean
  required?: boolean
  withAppearance?: boolean
}

/** Reusable link group: internal reference, site route (locale-independent) or external URL, with localized label. */
export const linkField = ({
  name = 'link',
  label,
  withLabel = true,
  required = false,
  withAppearance = false,
}: LinkOptions = {}): GroupField => ({
  name,
  label,
  type: 'group',
  admin: { hideGutter: true },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'type',
          type: 'radio',
          defaultValue: 'internal',
          options: [
            { label: { tr: 'Site içi', en: 'Internal' }, value: 'internal' },
            { label: { tr: 'Harici', en: 'External' }, value: 'external' },
            // Added in F7 (append only: existing values/default unchanged).
            { label: { tr: 'Site sayfası (yol)', en: 'Site route' }, value: 'route' },
          ],
          label: { tr: 'Bağlantı türü', en: 'Link type' },
          admin: { layout: 'horizontal' },
        },
        {
          name: 'newTab',
          type: 'checkbox',
          label: { tr: 'Yeni sekmede aç', en: 'Open in new tab' },
        },
      ],
    },
    {
      name: 'reference',
      type: 'relationship',
      relationTo: LINKABLE_COLLECTIONS,
      maxDepth: 1,
      label: { tr: 'Hedef kayıt', en: 'Target document' },
      admin: { condition: (_, sibling) => sibling?.type === 'internal' },
    },
    {
      // Locale-independent: one TR canonical route, resolved to /tr/... or /en/... at render.
      name: 'route',
      type: 'select',
      options: routeOptions(),
      label: { tr: 'Site sayfası', en: 'Site route' },
      admin: {
        condition: (_, sibling) => sibling?.type === 'route',
        description: { tr: 'Dil önekini eklemeyin; EN adresi otomatik çözülür.', en: 'No locale prefix: the EN address is resolved automatically.' },
      },
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
        siblingData?.type !== 'route' || Boolean(value) || 'Site sayfası seçin / Choose a site route',
    },
    {
      name: 'routeParam',
      type: 'text',
      label: { tr: 'Yol parametresi (slug)', en: 'Route parameter (slug)' },
      admin: {
        condition: (_, sibling) => sibling?.type === 'route' && routeHasParam(sibling?.route),
        description: { tr: 'Örn. kvkk-aydinlatma', en: 'e.g. kvkk-aydinlatma' },
      },
      validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
        siblingData?.type !== 'route' || !routeHasParam(siblingData.route) ||
        (typeof value === 'string' && ROUTE_PARAM_PATTERN.test(value)) ||
        'Geçerli bir slug girin (a-z, 0-9, -) / Enter a valid slug (a-z, 0-9, -)',
    },
    {
      name: 'url',
      type: 'text',
      localized: true,
      label: { tr: 'Adres (URL)', en: 'URL' },
      admin: { condition: (_, sibling) => sibling?.type === 'external' },
    },
    ...(withLabel
      ? [{ name: 'label', type: 'text' as const, localized: true, required, label: { tr: 'Metin', en: 'Label' } }]
      : []),
    ...(withAppearance
      ? [
          {
            name: 'appearance',
            type: 'select' as const,
            defaultValue: 'primary',
            label: { tr: 'Görünüm', en: 'Appearance' },
            options: [
              { label: { tr: 'Birincil', en: 'Primary' }, value: 'primary' },
              { label: { tr: 'İkincil', en: 'Secondary' }, value: 'secondary' },
              { label: { tr: 'Metin bağlantısı', en: 'Link' }, value: 'link' },
            ],
          },
        ]
      : []),
  ],
})
