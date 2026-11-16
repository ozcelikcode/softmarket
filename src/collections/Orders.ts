import { ValidationError, type CollectionBeforeValidateHook, type CollectionConfig, type Field, type FieldAccess } from 'payload'

import { isAdmin, isAdminField, isAdminOrEditorField, isAdminOrEditorUser, isAdminUser, isCustomerUser, isOwnerCustomer, nobody } from '@/access'
import { BUYER_TYPES, isValidTckn, isValidVkn } from '@/lib/payments/identity'
import { generateOrderNumber, ORDER_NUMBER_RE } from '@/lib/payments/idempotency'
import { isValidMinor } from '@/lib/payments/money'
import { ORDER_STATUSES } from '@/lib/payments/state'
import { CURRENCIES, PROVIDER_ENVS, PROVIDER_IDS, TAX_MODES } from '@/lib/payments/types'
import { LICENSE_TYPES } from './Editions'

/*
 * P2-S orders (plan §2.1). Created ONLY by server code (`overrideAccess: true`, P4/P5); no REST/GraphQL/MCP
 * create for anyone. Staff read all; a customer reads only their own orders, in every commerce mode (S3: after
 * switching to quote-only the history stays visible read-only). Admins may update only `invoice`, `notes` and
 * `requiresReview`; every other field is locked by field access. Never deleted (VUK/TTK retention).
 * Buyer identity/address (`billing`) and consent evidence are hidden from editors.
 */

const nobodyField: FieldAccess = () => false
const adminOrCustomer: FieldAccess = ({ req: { user } }) => isAdminUser(user) || isCustomerUser(user)
const staffOrCustomer: FieldAccess = ({ req: { user } }) => isAdminOrEditorUser(user) || isCustomerUser(user)
type Sibling = Partial<Record<string, unknown>>
const msg = (tr: string, en: string) => `${tr} / ${en}`
const requiredMinor = (value: unknown) => isValidMinor(value) ? true : msg('Geçersiz tutar (kuruş/cent).', 'Invalid amount (minor units).')
const opts = <T extends string>(values: readonly T[], labels: Record<T, [string, string]>) =>
  values.map((value) => ({ value, label: { tr: labels[value][0], en: labels[value][1] } }))

/** Server-written fields: readOnly in the admin, update denied for everyone (server code uses overrideAccess). */
const locked = (fields: Field[]): Field[] => fields.map((field) => {
  if (!('name' in field) || field.type === 'ui') return field
  return {
    ...field,
    access: { ...('access' in field ? field.access : {}), create: nobodyField, update: nobodyField },
    admin: { ...field.admin, readOnly: true },
  } as Field
})

const STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], [string, string]> = {
  pending: ['Ödeme bekleniyor', 'Pending'],
  paid: ['Ödendi', 'Paid'],
  fulfilled: ['Tamamlandı (lisans atandı)', 'Fulfilled (license assigned)'],
  failed: ['Başarısız', 'Failed'],
  refunded: ['İade edildi', 'Refunded'],
  cancelled: ['İptal edildi', 'Cancelled'],
}

const assignOrderNumber: CollectionBeforeValidateHook = ({ data, operation }) => {
  if (operation === 'create' && data && !data.orderNumber) return { ...data, orderNumber: generateOrderNumber(new Date()) }
  return data
}

/** Amount invariant on every write: total = subtotal + VAT, and the line totals add up to the total. */
const checkTotals: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const doc = { ...originalDoc, ...data } as Record<string, unknown>
  const items = (Array.isArray(doc.items) ? doc.items : []) as Record<string, unknown>[]
  const [subtotal, vat, total] = [doc.subtotalMinor, doc.vatMinor, doc.totalMinor]
  const lines = items.reduce<number>((sum, item) => sum + (typeof item.lineTotalMinor === 'number' ? item.lineTotalMinor : NaN), 0)
  const validItems = items.every((item) => isValidMinor(item.unitNetMinor) && isValidMinor(item.vatMinor) &&
    isValidMinor(item.lineTotalMinor) && item.unitNetMinor + item.vatMinor === item.lineTotalMinor)
  const lineNet = items.reduce<number>((sum, item) => sum + Number(item.unitNetMinor), 0)
  const lineVat = items.reduce<number>((sum, item) => sum + Number(item.vatMinor), 0)
  if (!validItems || ![subtotal, vat, total].every(isValidMinor) || (subtotal as number) + (vat as number) !== total || lines !== total || lineNet !== subtotal || lineVat !== vat) {
    throw new ValidationError({ collection: 'orders', errors: [{ path: 'totalMinor', message: msg('Tutar dökümü tutarsız.', 'Amount breakdown is inconsistent.') }] })
  }
  return data
}

const itemFields: Field[] = [
  { name: 'edition', type: 'relationship', relationTo: 'editions', label: { tr: 'Lisans sürümü', en: 'Edition' } },
  { name: 'sku', type: 'text', required: true, label: { tr: 'SKU', en: 'SKU' } },
  { name: 'title', type: 'text', required: true, label: { tr: 'Sürüm adı (sipariş anı)', en: 'Edition name (at order time)' } },
  {
    name: 'licenseType', type: 'select', required: true, label: { tr: 'Lisans türü', en: 'License type' },
    options: opts(LICENSE_TYPES, { perpetual: ['Kalıcı', 'Perpetual'], subscription: ['Abonelik', 'Subscription'] }),
  },
  { name: 'durationMonths', type: 'number', label: { tr: 'Süre (ay)', en: 'Duration (months)' } },
  { name: 'seats', type: 'number', required: true, label: { tr: 'Koltuk sayısı', en: 'Seats' } },
  {
    name: 'taxMode', type: 'select', required: true, label: { tr: 'KDV', en: 'VAT' },
    options: opts(TAX_MODES, { inclusive: ['Fiyata dahil', 'Included in price'], exclusive: ['Fiyata eklenir', 'Added to price'] }),
  },
  { name: 'unitNetMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'Birim net (kuruş/cent)', en: 'Unit net (minor units)' } },
  { name: 'vatRateBasisPoints', type: 'number', required: true, label: { tr: 'KDV oranı (baz puan, 2000 = %20)', en: 'VAT rate (basis points, 2000 = 20%)' } },
  { name: 'vatMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'KDV (kuruş/cent)', en: 'VAT (minor units)' } },
  { name: 'lineTotalMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'Satır toplamı (kuruş/cent)', en: 'Line total (minor units)' } },
  {
    // Written by fulfillment in the same transaction as the licence and the paid → fulfilled transition.
    name: 'license', type: 'relationship', relationTo: 'licenses', index: true,
    label: { tr: 'Atanan lisans', en: 'Assigned license' },
  },
]

const billingFields: Field[] = [
  {
    name: 'type', type: 'select', required: true, label: { tr: 'Alıcı tipi', en: 'Buyer type' },
    options: opts(BUYER_TYPES, { individual: ['Bireysel (TCKN)', 'Individual (national ID)'], corporate: ['Kurumsal (VKN)', 'Corporate (tax ID)'] }),
  },
  { name: 'name', type: 'text', required: true, label: { tr: 'Ad soyad', en: 'Full name' } },
  {
    name: 'company', type: 'text', label: { tr: 'Ticaret unvanı', en: 'Company name' },
    validate: (value: unknown, { siblingData }: { siblingData: Sibling }) =>
      siblingData?.type !== 'corporate' || (typeof value === 'string' && value.trim()) ? true : msg('Kurumsal alıcıda unvan zorunlu.', 'Company name is required for corporate buyers.'),
  },
  {
    name: 'identityNumber', type: 'text', label: { tr: 'TC kimlik no', en: 'National ID (TCKN)' },
    validate: (value: unknown, { siblingData }: { siblingData: Sibling }) =>
      siblingData?.type !== 'individual' || isValidTckn(value) ? true : msg('Geçerli bir TCKN girin.', 'Enter a valid TCKN.'),
  },
  {
    name: 'taxNumber', type: 'text', label: { tr: 'Vergi kimlik no (VKN)', en: 'Tax ID (VKN)' },
    validate: (value: unknown, { siblingData }: { siblingData: Sibling }) =>
      siblingData?.type !== 'corporate' || isValidVkn(value) ? true : msg('VKN 10 haneli olmalı.', 'Tax ID must have 10 digits.'),
  },
  {
    name: 'taxOffice', type: 'text', label: { tr: 'Vergi dairesi', en: 'Tax office' },
    validate: (value: unknown, { siblingData }: { siblingData: Sibling }) =>
      siblingData?.type !== 'corporate' || (typeof value === 'string' && value.trim()) ? true : msg('Kurumsal alıcıda vergi dairesi zorunlu.', 'Tax office is required for corporate buyers.'),
  },
  { name: 'email', type: 'email', required: true, label: { tr: 'E-posta', en: 'Email' } },
  { name: 'phone', type: 'text', label: { tr: 'Telefon', en: 'Phone' } },
  { name: 'addressLine', type: 'textarea', label: { tr: 'Adres', en: 'Address' } },
  { name: 'district', type: 'text', label: { tr: 'İlçe', en: 'District' } },
  { name: 'city', type: 'text', label: { tr: 'İl', en: 'City' } },
  { name: 'postalCode', type: 'text', label: { tr: 'Posta kodu', en: 'Postal code' } },
  { name: 'country', type: 'text', defaultValue: 'TR', label: { tr: 'Ülke (ISO kodu)', en: 'Country (ISO code)' } },
]

const consentFields: Field[] = [
  { name: 'preInformationVersion', type: 'text', label: { tr: 'Ön bilgilendirme formu sürümü', en: 'Pre-information form version' } },
  { name: 'distanceSalesVersion', type: 'text', label: { tr: 'Mesafeli satış sözleşmesi sürümü', en: 'Distance sales agreement version' } },
  {
    name: 'digitalWaiverAccepted', type: 'checkbox', defaultValue: false,
    label: { tr: 'Anında ifa ve cayma istisnası onayı', en: 'Immediate performance and withdrawal waiver accepted' },
  },
  { name: 'acceptedAt', type: 'date', label: { tr: 'Onay zamanı', en: 'Accepted at' }, admin: { date: { pickerAppearance: 'dayAndTime' } } },
  { name: 'ip', type: 'text', label: { tr: 'IP adresi', en: 'IP address' } },
  { name: 'userAgent', type: 'text', label: { tr: 'Tarayıcı bilgisi', en: 'Browser (user agent)' } },
  { name: 'snapshotSha256', type: 'text', label: { tr: 'Sözleşme kopyası özeti (SHA-256)', en: 'Contract copy digest (SHA-256)' } },
]

const dateField = (name: string, tr: string, en: string): Field => ({
  name, type: 'date', label: { tr, en }, admin: { date: { pickerAppearance: 'dayAndTime' } },
})

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'customer', 'status', 'totalMinor', 'currency', 'createdAt'],
    group: 'Sales',
  },
  defaultSort: '-createdAt',
  access: {
    read: isOwnerCustomer('customer'),
    create: nobody,
    update: isAdmin,
    delete: nobody,
  },
  indexes: [{ fields: ['provider', 'providerRef'], unique: true }],
  hooks: { beforeValidate: [assignOrderNumber, checkTotals] },
  fields: [
    ...locked([
      {
        name: 'orderNumber', type: 'text', required: true, unique: true,
        label: { tr: 'Sipariş no', en: 'Order number' },
        validate: (value: unknown) => typeof value === 'string' && ORDER_NUMBER_RE.test(value) ? true : msg('Biçim SM-YYAAGG-XXXXXX olmalı.', 'Format must be SM-YYMMDD-XXXXXX.'),
      },
      { name: 'customer', type: 'relationship', relationTo: 'customers', index: true, label: { tr: 'Müşteri', en: 'Customer' } },
      {
        name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true,
        label: { tr: 'Durum', en: 'Status' },
        options: opts(ORDER_STATUSES, STATUS_LABELS),
      },
      {
        name: 'items', type: 'array', required: true, minRows: 1,
        label: { tr: 'Kalemler', en: 'Items' },
        labels: { singular: { tr: 'Kalem', en: 'Item' }, plural: { tr: 'Kalemler', en: 'Items' } },
        fields: itemFields,
      },
      {
        name: 'currency', type: 'select', required: true, label: { tr: 'Para birimi', en: 'Currency' },
        options: CURRENCIES.map((c) => ({ value: c, label: { tr: c, en: c } })),
      },
      { name: 'subtotalMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'Ara toplam, net (kuruş/cent)', en: 'Subtotal, net (minor units)' } },
      { name: 'vatMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'KDV toplamı (kuruş/cent)', en: 'VAT total (minor units)' } },
      { name: 'totalMinor', type: 'number', required: true, validate: requiredMinor, label: { tr: 'Genel toplam (kuruş/cent)', en: 'Grand total (minor units)' } },
      {
        name: 'provider', type: 'select', required: true, label: { tr: 'Ödeme sağlayıcısı', en: 'Payment provider' },
        options: PROVIDER_IDS.map((p) => ({ value: p, label: { tr: p, en: p } })),
      },
      {
        name: 'providerEnv', type: 'select', label: { tr: 'Sağlayıcı ortamı', en: 'Provider environment' },
        options: opts(PROVIDER_ENVS, { sandbox: ['Test', 'Sandbox'], live: ['Canlı', 'Live'] }),
      },
      { name: 'providerRef', type: 'text', index: true, label: { tr: 'Sağlayıcı oturum referansı', en: 'Provider session reference' } },
      { name: 'providerPaymentId', type: 'text', index: true, label: { tr: 'Sağlayıcı ödeme no', en: 'Provider payment ID' } },
      {
        name: 'idempotencyKey', type: 'text', required: true, unique: true,
        label: { tr: 'Tekrar koruma anahtarı', en: 'Idempotency key' },
        access: { read: isAdminOrEditorField },
        validate: (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_:.-]{16,128}$/.test(value) ? true : msg('Geçersiz anahtar.', 'Invalid key.'),
      },
      {
        name: 'locale', type: 'select', defaultValue: 'tr', label: { tr: 'Sipariş dili', en: 'Order language' },
        options: [{ value: 'tr', label: { tr: 'Türkçe', en: 'Türkçe' } }, { value: 'en', label: { tr: 'English', en: 'English' } }],
      },
      dateField('paidAt', 'Ödeme zamanı', 'Paid at'),
      dateField('fulfilledAt', 'Lisans atama zamanı', 'Fulfilled at'),
      dateField('refundedAt', 'İade zamanı', 'Refunded at'),
      dateField('cancelledAt', 'İptal zamanı', 'Cancelled at'),
      { name: 'failureReason', type: 'text', label: { tr: 'Hata kodu', en: 'Failure code' } },
      {
        name: 'billing', type: 'group', label: { tr: 'Fatura bilgisi', en: 'Billing details' },
        access: { read: adminOrCustomer },
        fields: billingFields,
      },
      {
        name: 'consents', type: 'group', label: { tr: 'Yasal onaylar', en: 'Legal consents' },
        access: { read: adminOrCustomer },
        fields: consentFields,
      },
      {
        name: 'contractSnapshot', type: 'textarea',
        access: { read: staffOrCustomer },
        label: { tr: 'Sözleşme kopyası (onay anı)', en: 'Contract copy (at acceptance)' },
      },
    ]),
    {
      name: 'requiresReview', type: 'checkbox', defaultValue: false,
      label: { tr: 'İnceleme gerekiyor', en: 'Needs review' },
      access: { read: isAdminOrEditorField, create: nobodyField, update: isAdminField },
      admin: {
        position: 'sidebar',
        description: { tr: 'Tutar uyuşmazlığı veya geç ödeme: lisans otomatik atanmaz.', en: 'Amount mismatch or late payment: no license is assigned automatically.' },
      },
    },
    {
      name: 'invoice', type: 'group', label: { tr: 'Fatura', en: 'Invoice' },
      access: { read: adminOrCustomer, create: nobodyField, update: isAdminField },
      fields: [
        { name: 'number', type: 'text', label: { tr: 'Fatura no', en: 'Invoice number' } },
        dateField('issuedAt', 'Fatura tarihi', 'Issued at'),
        { name: 'note', type: 'textarea', label: { tr: 'Fatura notu', en: 'Invoice note' } },
      ],
    },
    {
      name: 'notes', type: 'textarea', label: { tr: 'Notlar', en: 'Notes' },
      access: { read: isAdminOrEditorField, create: nobodyField, update: isAdminField },
      admin: { position: 'sidebar', description: { tr: 'Yalnız personel görür.', en: 'Visible to staff only.' } },
    },
  ],
}
