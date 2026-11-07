import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { normalizeHex, validateAccent } from '@/lib/brand'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  admin: { group: 'Site' },
  access: { read: anyone, update: isAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            { name: 'siteName', type: 'text', localized: true, required: true, defaultValue: 'SoftMarket' },
            { name: 'tagline', type: 'text', localized: true },
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: { description: { tr: 'Açık zeminler için (herkese açık medya). Boşsa varsayılan işaret + site adı.', en: 'For light backgrounds (public media). Empty: default mark + site name.' } },
            },
            {
              name: 'logoDark',
              type: 'upload',
              relationTo: 'media',
              admin: { description: { tr: 'Koyu zeminler için (header/footer). Boşsa "logo" kullanılır.', en: 'For dark backgrounds (header/footer). Empty: "logo" is used.' } },
            },
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
            {
              name: 'favicon',
              type: 'upload',
              relationTo: 'media',
              admin: { description: { tr: 'Kare PNG/SVG/ICO (herkese açık). Boşsa varsayılan simge.', en: 'Square PNG/SVG/ICO (public). Empty: default icon.' } },
            },
          ],
        },
        {
          label: { tr: 'Marka ve hareket', en: 'Brand & motion' },
          fields: [
            {
              name: 'brand',
              type: 'group',
              fields: [
                {
                  name: 'accent',
                  type: 'text',
                  label: { tr: 'Vurgu rengi (hex)', en: 'Accent color (hex)' },
                  admin: {
                    placeholder: '#2f5fe0',
                    description: {
                      tr: 'Tek vurgu rengi. Koyu/açık tema, hover ve buton metni tonları otomatik türetilir; WCAG AA (4,5:1) sağlanamazsa kayıt reddedilir. Boşsa varsayılan palet.',
                      en: 'Single accent color. Dark/light, hover and button text tones are derived; saving is rejected below WCAG AA (4.5:1). Empty: default palette.',
                    },
                  },
                  hooks: { beforeValidate: [({ value }) => (value ? (normalizeHex(value) ?? value) : null)] },
                  validate: (value: string | null | undefined, { req }: { req?: { i18n?: { language?: string } } }) =>
                    validateAccent(value, req?.i18n?.language),
                },
              ],
            },
            {
              name: 'motion',
              type: 'select',
              defaultValue: 'subtle',
              label: { tr: 'Animasyon', en: 'Motion' },
              admin: { description: { tr: '"Kapalı" tüm site animasyonlarını devre dışı bırakır.', en: '"None" turns off all site animations.' } },
              options: [
                { label: { tr: 'Hafif', en: 'Subtle' }, value: 'subtle' },
                { label: { tr: 'Kapalı', en: 'None' }, value: 'none' },
              ],
            },
          ],
        },
        {
          label: 'Company & Contact',
          fields: [
            {
              name: 'company',
              type: 'group',
              fields: [
                { name: 'legalName', type: 'text' },
                { name: 'taxOffice', type: 'text' },
                { name: 'taxNumber', type: 'text' },
                { name: 'mersisNo', type: 'text' },
                { name: 'kepAddress', type: 'email' },
              ],
            },
            {
              name: 'contact',
              type: 'group',
              fields: [
                { name: 'email', type: 'email' },
                { name: 'salesEmail', type: 'email' },
                { name: 'supportEmail', type: 'email' },
                { name: 'phone', type: 'text' },
                { name: 'address', type: 'textarea', localized: true },
                { name: 'mapUrl', type: 'text' },
                { name: 'workingHours', type: 'text', localized: true },
              ],
            },
            {
              name: 'social',
              type: 'array',
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  required: true,
                  options: ['linkedin', 'x', 'youtube', 'instagram', 'facebook', 'github'].map((p) => ({
                    label: p,
                    value: p,
                  })),
                },
                { name: 'url', type: 'text', required: true },
              ],
            },
          ],
        },
        {
          label: 'Legal',
          description: 'Legal pages (pages collection, pageType=legal).',
          fields: [
            {
              name: 'legal',
              type: 'group',
              fields: [
                'kvkk',
                'privacy',
                'cookies',
                'terms',
                'eula',
              ].map((name) => ({
                name,
                type: 'relationship' as const,
                relationTo: 'pages' as const,
              })),
            },
          ],
        },
        {
          label: 'Requests',
          fields: [
            {
              name: 'commerce',
              type: 'group',
              fields: [
                {
                  name: 'quoteForm',
                  type: 'relationship',
                  relationTo: 'forms',
                  admin: { description: 'Form for all editions ("Teklif İste").' },
                },
                { name: 'demoForm', type: 'relationship', relationTo: 'forms' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
