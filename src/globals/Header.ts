import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { linkField } from '@/fields/link'

export const Header: GlobalConfig = {
  slug: 'header',
  admin: { group: 'Site' },
  access: { read: anyone, update: isAdminOrEditor },
  fields: [
    {
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      fields: [
        linkField(),
        {
          name: 'megaMenu',
          type: 'select',
          admin: { description: 'Auto-generated mega menu instead of manual children.' },
          options: [
            { label: 'Product families → products', value: 'products' },
            { label: 'Solutions & industries', value: 'solutions' },
          ],
        },
        {
          name: 'children',
          type: 'array',
          fields: [linkField(), { name: 'description', type: 'text', localized: true }],
        },
      ],
    },
    {
      name: 'cta',
      type: 'group',
      admin: { description: 'Primary header button (e.g. "Demo İste").' },
      fields: [linkField({ name: 'link' })],
    },
  ],
}
