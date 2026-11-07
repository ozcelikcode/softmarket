import type { GlobalConfig } from 'payload'

import { anyone, isAdmin } from '@/access'

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
            { name: 'logo', type: 'upload', relationTo: 'media' },
            { name: 'logoDark', type: 'upload', relationTo: 'media' },
            { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
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
