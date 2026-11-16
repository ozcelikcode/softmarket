import type { CollectionConfig, Field } from 'payload'

import { anyone, isAdminField, isAdminOrEditor, isAdminOrEditorField } from '@/access'
import { sortOrderField } from '@/fields/common'
import { isValidMinor } from '@/lib/payments/money'
import { CURRENCIES, EDITION_SALE_MODES, PRICE_FIELDS, TAX_MODES } from '@/lib/payments/types'

export const LICENSE_TYPES = ['perpetual', 'subscription'] as const
export type LicenseType = (typeof LICENSE_TYPES)[number]

/*
 * P2-S commerce fields. Only admins write them (editors edit the edition text, never price or sale mode); only
 * staff read them, so anonymous/customer reads and therefore public HTML stay byte-identical until P3 exposes
 * prices through the commerce gate (server reads with overrideAccess). Never accepted by content:import
 * (`custom.contentImport: false`); prices are set in the admin panel or with the admin MCP key only.
 */
const commerceAccess = { read: isAdminOrEditorField, create: isAdminField, update: isAdminField }
const noImport = { contentImport: false }
const commerceFields = [
  {
    name: 'saleMode',
    type: 'select',
    defaultValue: 'quote',
    access: commerceAccess,
    custom: noImport,
    label: { tr: 'Satış şekli', en: 'Sale mode' },
    validate: (value: unknown, { siblingData }: { siblingData: Partial<Record<string, unknown>> }) => {
      if (value !== 'buy') return true
      const pricing = (siblingData?.pricing ?? {}) as Record<string, unknown>
      return CURRENCIES.some((c) => isValidMinor(pricing[PRICE_FIELDS[c]]) && Number(pricing[PRICE_FIELDS[c]]) > 0)
        ? true
        : '"Satın al" için en az bir fiyat girin. / Enter at least one price for "Buy online".'
    },
    options: [
      { label: { tr: 'Teklif iste', en: 'Request a quote' }, value: EDITION_SALE_MODES[0] },
      { label: { tr: 'Satın al', en: 'Buy online' }, value: EDITION_SALE_MODES[1] },
    ],
    admin: {
      position: 'sidebar',
      description: {
        tr: '"Satın al" yalnız site ayarlarında ödeme modu açıkken ve bu sürümde geçerli bir fiyat varken görünür; aksi halde "Teklif iste" kalır.',
        en: '"Buy online" is shown only while payments are on in site settings and this edition has a valid price; otherwise "Request a quote" stays.',
      },
    },
  },
  {
    name: 'pricing',
    type: 'group',
    access: commerceAccess,
    custom: noImport,
    label: { tr: 'Fiyat', en: 'Pricing' },
    admin: {
      description: {
        tr: 'Tutarlar kuruş/cent cinsinden tam sayıdır (1.250,00 TL = 125000). Boş bırakılan para biriminde satış yapılmaz.',
        en: 'Amounts are integers in minor units (1,250.00 = 125000). A currency left empty is not sold.',
      },
    },
    fields: [
      {
        name: 'taxMode',
        type: 'select',
        defaultValue: 'inclusive',
        label: { tr: 'KDV', en: 'VAT' },
        options: [
          { label: { tr: 'Fiyata dahil', en: 'Included in price' }, value: TAX_MODES[0] },
          { label: { tr: 'Fiyata eklenir', en: 'Added to price' }, value: TAX_MODES[1] },
        ],
      },
      {
        type: 'row',
        fields: CURRENCIES.map((currency) => ({
          name: PRICE_FIELDS[currency],
          type: 'number',
          min: 0,
          label: { tr: `${currency} fiyatı (kuruş/cent)`, en: `${currency} price (minor units)` },
          validate: (value: number | null | undefined) =>
            value === null || value === undefined || (isValidMinor(value) && value > 0)
              ? true
              : 'Pozitif tam sayı olmalı (kuruş/cent). / Must be a positive integer (minor units).',
        })),
      },
    ],
  },
] satisfies Field[]

/** Product edition identified by a stable code for quote requests and license assignment. */
export const Editions: CollectionConfig = {
  slug: 'editions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'product', 'sku', 'licenseType'],
    group: 'Catalog',
  },
  defaultSort: 'sortOrder',
  access: {
    read: anyone,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  fields: [
    { name: 'title', type: 'text', localized: true, required: true },
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Stable identifier used in quote requests and license assignment (e.g. ERP-PRO-1Y).' },
      validate: (value: string | null | undefined) =>
        value && /^[A-Z0-9][A-Z0-9-]{1,63}$/.test(value) ? true : 'Use A-Z, 0-9 and "-" (2-64 chars).',
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      index: true,
    },
    { name: 'description', type: 'textarea', localized: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [{ name: 'text', type: 'text', localized: true, required: true }],
    },
    {
      name: 'licenseType',
      type: 'select',
      required: true,
      defaultValue: 'perpetual',
      options: [
        { label: 'Perpetual', value: 'perpetual' },
        { label: 'Subscription', value: 'subscription' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'durationMonths',
      type: 'number',
      min: 1,
      admin: {
        position: 'sidebar',
        condition: (_, sibling) => sibling?.licenseType === 'subscription',
      },
      validate: (
        value: number | null | undefined,
        { siblingData }: { siblingData: Partial<Record<string, unknown>> },
      ) =>
        siblingData?.licenseType !== 'subscription' || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1)
          ? true
          : 'Subscription editions need a duration (months).',
    },
    {
      name: 'seats',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: { position: 'sidebar' },
    },
    sortOrderField,
    ...commerceFields,
  ],
}
