import type { Field, FieldAccess, GlobalConfig } from 'payload'

import { anyone, isAdmin, isAdminOrEditorField, isAdminUser } from '@/access'
import { normalizeHex, validateAccent } from '@/lib/brand'
import { readCapability } from '@/lib/payments/mode'
import { percentToBasisPoints, readVatSettings, VAT_GROUPS, VAT_RULE_KINDS } from '@/lib/payments/settings'
import { CURRENCIES, SITE_COMMERCE_MODES } from '@/lib/payments/types'

/*
 * P2-S commerce switch (plan §1.2). Default `quote-only` hides the payment system completely. Staff read these
 * fields (public reads and HTML stay unchanged; server code reads with overrideAccess). Only an admin in a PANEL
 * session writes them: an API key (MCP) cannot switch payments on, enable a provider or change VAT. Field access
 * silently drops such a write. Never accepted by content:import. Provider secrets live only in env.
 */
const panelAdmin: FieldAccess = ({ req: { user } }) =>
  isAdminUser(user) && (user as { _strategy?: string } | null)?._strategy !== 'api-key'
const commerceAccess = { read: isAdminOrEditorField, create: panelAdmin, update: panelAdmin }
const noImport = { contentImport: false }
type Sibling = Partial<Record<string, unknown>>
const bilingual = (tr: string, en: string) => `${tr} / ${en}`

const vatGroup = (currency: (typeof CURRENCIES)[number]): Field => ({
  name: VAT_GROUPS[currency],
  type: 'group',
  label: { tr: `${currency} KDV`, en: `${currency} VAT` },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'rule',
          type: 'select',
          label: { tr: 'Kural', en: 'Rule' },
          admin: { description: { tr: 'Boş: bu para biriminde satış kapalı.', en: 'Empty: no sales in this currency.' } },
          options: [
            { label: { tr: 'Oran', en: 'Rate' }, value: VAT_RULE_KINDS[0] },
            { label: { tr: 'İstisna', en: 'Exempt' }, value: VAT_RULE_KINDS[1] },
          ],
        },
        {
          name: 'ratePercent',
          type: 'number',
          min: 0,
          max: 100,
          label: { tr: 'Oran (%)', en: 'Rate (%)' },
          admin: { condition: (_, sibling) => sibling?.rule === 'rate', step: 0.01 },
          validate: (value: number | null | undefined, { siblingData }: { siblingData: Sibling }) =>
            siblingData?.rule !== 'rate' || percentToBasisPoints(value) !== null
              ? true
              : bilingual('0 ile 100 arasında, en çok 2 ondalık.', 'Between 0 and 100, at most 2 decimals.'),
        },
        {
          // Stored integer basis points (20 % = 2000) derived from the percent; the only value tax.ts reads.
          name: 'rateBasisPoints',
          type: 'number',
          admin: { hidden: true, readOnly: true },
          hooks: {
            beforeValidate: [({ siblingData }) => (siblingData?.rule === 'rate' ? percentToBasisPoints(siblingData.ratePercent) : null)],
          },
        },
      ],
    },
  ],
})

const commerceFields: Field[] = [
  {
    // P3 read-only readiness checklist (`ui`: no DB column, no schema change).
    name: 'readiness',
    type: 'ui',
    admin: { components: { Field: '@/admin/fields/commerce-readiness#CommerceReadiness' } },
  },
  {
    name: 'mode',
    type: 'select',
    defaultValue: 'quote-only',
    access: commerceAccess,
    custom: noImport,
    label: { tr: 'Satış modu', en: 'Sales mode' },
    options: [
      { label: { tr: 'Teklif iste (ödeme kapalı)', en: 'Request a quote (payments off)' }, value: SITE_COMMERCE_MODES[0] },
      { label: { tr: 'Ödeme al', en: 'Take payments' }, value: SITE_COMMERCE_MODES[1] },
    ],
    admin: {
      description: {
        tr: '"Teklif iste" seçiliyken fiyat, satın alma ve sipariş ekranları sitede hiç görünmez. Teklif moduna dönünce yeni satış hemen kapanır; mevcut siparişler korunur.',
        en: 'With "Request a quote", prices, checkout and order screens never appear on the site. Switching back closes new sales at once; existing orders are kept.',
      },
    },
    validate: (value: unknown, { previousValue, siblingData }: { previousValue?: unknown; siblingData: Sibling }) => {
      if (value !== 'payments') return true
      const missing: string[] = []
      if (previousValue !== 'payments' && !readCapability(process.env)) missing.push(bilingual('sunucuda PAYMENTS_ENABLED=true', 'PAYMENTS_ENABLED=true on the server'))
      const providers = (siblingData?.providers ?? {}) as Record<string, { enabled?: unknown } | undefined>
      if (!Object.values(providers).some((p) => p?.enabled === true)) missing.push(bilingual('en az bir açık ödeme sağlayıcısı', 'at least one enabled payment provider'))
      if (Object.keys(readVatSettings({ commerce: siblingData })).length === 0) missing.push(bilingual('en az bir para birimi için KDV kuralı', 'a VAT rule for at least one currency'))
      return missing.length ? `${bilingual('Ödeme modu için eksik', 'Payments mode needs')}: ${missing.join('; ')}` : true
    },
  },
  {
    name: 'providers',
    type: 'group',
    access: commerceAccess,
    custom: noImport,
    label: { tr: 'Ödeme sağlayıcıları', en: 'Payment providers' },
    admin: {
      description: {
        tr: 'Anahtarlar yalnız sunucu ortam değişkenlerindedir; burada saklanmaz. Test/canlı ortamı da sunucu belirler.',
        en: 'Keys live only in server environment variables, never here. The server also decides test/live.',
      },
    },
    fields: [
      {
        name: 'iyzico',
        type: 'group',
        label: { tr: 'iyzico', en: 'iyzico' },
        fields: [{ name: 'enabled', type: 'checkbox', defaultValue: false, label: { tr: 'Açık', en: 'Enabled' } }],
      },
      {
        name: 'stripe',
        type: 'group',
        label: { tr: 'Stripe', en: 'Stripe' },
        admin: {
          description: {
            tr: 'Varsayılan kapalı: Stripe Türkiye merkezli şirketlere hizmet vermez. Yalnız sunucu izin verirse (PAYMENTS_STRIPE_ENABLED=true) açılabilir.',
            en: 'Off by default: Stripe does not serve companies based in Türkiye. Can be enabled only with PAYMENTS_STRIPE_ENABLED=true on the server.',
          },
        },
        fields: [{
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          label: { tr: 'Açık', en: 'Enabled' },
          validate: (value: unknown, { previousValue }: { previousValue?: unknown }) =>
            value !== true || previousValue === true || process.env.PAYMENTS_STRIPE_ENABLED === 'true'
              ? true
              : bilingual('Stripe sunucuda kapalı (PAYMENTS_STRIPE_ENABLED).', 'Stripe is off on the server (PAYMENTS_STRIPE_ENABLED).'),
        }],
      },
    ],
  },
  {
    name: 'vat',
    type: 'group',
    access: commerceAccess,
    custom: noImport,
    label: { tr: 'KDV (para birimi başına)', en: 'VAT (per currency)' },
    admin: {
      description: {
        tr: 'Mali müşavirin kararına göre doldurun. Kuralı boş olan para biriminde satış yapılmaz.',
        en: 'Fill in as decided by the accountant. A currency without a rule is not sold.',
      },
    },
    fields: CURRENCIES.map(vatGroup),
  },
  {
    // S3 drain window start: written by the hook on payments → quote-only, never from input.
    name: 'quoteSince',
    type: 'date',
    access: { read: isAdminOrEditorField },
    custom: noImport,
    label: { tr: 'Teklif moduna geçiş zamanı', en: 'Switched to quote mode at' },
    admin: {
      readOnly: true,
      date: { pickerAppearance: 'dayAndTime' },
      description: {
        tr: 'Ödeme modundan çıkıldığında otomatik yazılır; sağlayıcı bildirimleri bundan sonra 72 saat işlenir.',
        en: 'Written automatically when payments are switched off; provider notifications are processed for 72 hours after it.',
      },
    },
    hooks: {
      beforeChange: [({ siblingData, previousSiblingDoc }) => {
        const previous = (previousSiblingDoc ?? {}) as Sibling
        const next = siblingData?.mode ?? previous.mode
        if (previous.mode === 'payments' && next !== 'payments') return new Date().toISOString()
        return previous.quoteSince ?? null
      }],
    },
  },
]

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
              name: 'homePage',
              type: 'relationship',
              relationTo: 'pages',
              label: { tr: 'Ana sayfa', en: 'Home page' },
              // Only pages that can be a home page: no legal texts, templates or system pages.
              filterOptions: {
                and: [
                  { pageType: { not_in: ['legal', 'template'] } },
                  { systemKey: { exists: false } },
                ],
              },
              admin: {
                description: {
                  tr: 'Ana sayfanın blokları bu sayfadan gelir (yayınlanmış olmalı). Boşsa slug\'ı "home" olan sayfa, o da yoksa yerleşik varsayılan ana sayfa.',
                  en: 'The home page blocks come from this page (must be published). Empty: the page with slug "home", else the built-in default home.',
                },
              },
            },
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
                {
                  type: 'collapsible',
                  label: { tr: 'Satış ve ödeme', en: 'Sales & payments' },
                  admin: { initCollapsed: true },
                  fields: commerceFields,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
