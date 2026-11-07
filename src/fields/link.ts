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
            { label: 'Internal', value: 'internal' },
            { label: 'External', value: 'external' },
          ],
          admin: { layout: 'horizontal' },
        },
        {
          name: 'newTab',
          type: 'checkbox',
          label: 'Open in new tab',
        },
      ],
    },
    {
      name: 'reference',
      type: 'relationship',
      relationTo: LINKABLE_COLLECTIONS,
      maxDepth: 1,
      admin: { condition: (_, sibling) => sibling?.type === 'internal' },
    },
    {
      name: 'url',
      type: 'text',
      localized: true,
      admin: { condition: (_, sibling) => sibling?.type === 'external' },
    },
    ...(withLabel
      ? [{ name: 'label', type: 'text' as const, localized: true, required }]
      : []),
    ...(withAppearance
      ? [
          {
            name: 'appearance',
            type: 'select' as const,
            defaultValue: 'primary',
            options: [
              { label: 'Primary', value: 'primary' },
              { label: 'Secondary', value: 'secondary' },
              { label: 'Link', value: 'link' },
            ],
          },
        ]
      : []),
  ],
})
