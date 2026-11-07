import type { CollectionSlug, GroupField } from 'payload'

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

/** Reusable link group: internal reference or external URL, with localized label. */
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
