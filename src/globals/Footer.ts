import type { GlobalConfig } from 'payload'

import { anyone, isAdminOrEditor } from '@/access'
import { linkField } from '@/fields/link'

/* F7: append-only. Contact and social data live in SiteSettings; the footer only toggles them. */
export const Footer: GlobalConfig = {
  slug: 'footer',
  label: { tr: 'Alt bilgi', en: 'Footer' },
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
    {
      name: 'copyright',
      type: 'text',
      localized: true,
      admin: {
        description: {
          tr: '{year} ve {siteName} yer tutucuları desteklenir. Boşsa "© {year} {siteName}. Tüm hakları saklıdır."',
          en: 'Supports {year} and {siteName}. Empty: "© {year} {siteName}. All rights reserved."',
        },
      },
    },
    { name: 'showNewsletter', type: 'checkbox', defaultValue: false },
    {
      name: 'newsletterForm',
      type: 'relationship',
      relationTo: 'forms',
      admin: { condition: (data) => Boolean(data?.showNewsletter) },
    },
    {
      name: 'brandBlurb',
      type: 'textarea',
      localized: true,
      label: { tr: 'Marka açıklaması', en: 'Brand blurb' },
      admin: { description: { tr: 'Logonun altındaki kısa metin. Boşsa site sloganı kullanılır.', en: 'Short text under the logo. Empty: the site tagline.' } },
    },
    {
      name: 'showContact',
      type: 'checkbox',
      defaultValue: true,
      label: { tr: 'İletişim bilgilerini göster (Site ayarları)', en: 'Show contact details (Site settings)' },
    },
    {
      name: 'showSocial',
      type: 'checkbox',
      defaultValue: true,
      label: { tr: 'Sosyal bağlantıları göster (Site ayarları)', en: 'Show social links (Site settings)' },
    },
  ],
}
