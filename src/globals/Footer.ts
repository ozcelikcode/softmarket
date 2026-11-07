import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { linkField } from '@/fields/link'

export const Footer: GlobalConfig = {
  slug: 'footer',
  admin: { group: 'Site' },
  access: { read: anyone, update: isAdminOrEditor },
  fields: [
    {
      name: 'columns',
      type: 'array',
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', localized: true, required: true },
        { name: 'links', type: 'array', fields: [linkField()] },
      ],
    },
    { name: 'legalLinks', type: 'array', fields: [linkField()] },
    { name: 'copyright', type: 'text', localized: true },
    { name: 'showNewsletter', type: 'checkbox', defaultValue: false },
    {
      name: 'newsletterForm',
      type: 'relationship',
      relationTo: 'forms',
      admin: { condition: (data) => Boolean(data?.showNewsletter) },
    },
  ],
}
