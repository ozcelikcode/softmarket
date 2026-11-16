import type { CollectionConfig, Field } from 'payload'

import { isAdmin, nobody } from '@/access'
import { PROVIDER_IDS } from '@/lib/payments/types'

/*
 * P2-S payment-events (plan §2.2): dedupe journal of verified provider notifications. Unique `eventKey`
 * (= provider:eventId) makes a replayed notification a no-op. The raw body is never stored (PII); only its
 * SHA-256. Read = admin; nobody creates/updates/deletes through any API (server store uses overrideAccess).
 */

export const PAYMENT_EVENT_STATUSES = ['received', 'processed', 'ignored', 'error'] as const

const readOnly = (fields: Field[]): Field[] => fields.map((f) => ({ ...f, admin: { ...f.admin, readOnly: true } }) as Field)

export const PaymentEvents: CollectionConfig = {
  slug: 'payment-events',
  admin: {
    useAsTitle: 'eventKey',
    defaultColumns: ['eventKey', 'type', 'status', 'order', 'receivedAt'],
    group: 'Sales',
  },
  defaultSort: '-receivedAt',
  access: { read: isAdmin, create: nobody, update: nobody, delete: nobody },
  fields: readOnly([
    {
      name: 'provider', type: 'select', required: true, label: { tr: 'Sağlayıcı', en: 'Provider' },
      options: PROVIDER_IDS.map((p) => ({ value: p, label: { tr: p, en: p } })),
    },
    { name: 'eventId', type: 'text', required: true, label: { tr: 'Olay no', en: 'Event ID' } },
    {
      name: 'eventKey', type: 'text', required: true, unique: true,
      label: { tr: 'Olay anahtarı', en: 'Event key' },
      admin: { description: { tr: 'Sağlayıcı ve olay numarası; aynı bildirim ikinci kez işlenmez.', en: 'Provider and event ID; the same notification is never processed twice.' } },
    },
    { name: 'type', type: 'text', required: true, label: { tr: 'Olay türü', en: 'Event type' } },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true, label: { tr: 'Sipariş', en: 'Order' } },
    {
      name: 'signatureVerified', type: 'checkbox', defaultValue: false,
      label: { tr: 'İmza doğrulandı', en: 'Signature verified' },
    },
    {
      name: 'bodySha256', type: 'text', required: true,
      label: { tr: 'Gövde özeti (SHA-256)', en: 'Body digest (SHA-256)' },
      validate: (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? true : 'SHA-256 hex',
    },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'received', index: true,
      label: { tr: 'İşlenme durumu', en: 'Processing status' },
      options: [
        { value: 'received', label: { tr: 'Alındı', en: 'Received' } },
        { value: 'processed', label: { tr: 'İşlendi', en: 'Processed' } },
        { value: 'ignored', label: { tr: 'Yok sayıldı', en: 'Ignored' } },
        { value: 'error', label: { tr: 'Hata', en: 'Error' } },
      ] satisfies { value: (typeof PAYMENT_EVENT_STATUSES)[number]; label: unknown }[],
    },
    { name: 'failureCode', type: 'text', label: { tr: 'Hata kodu', en: 'Failure code' } },
    { name: 'receivedAt', type: 'date', required: true, index: true, label: { tr: 'Alınma zamanı', en: 'Received at' }, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'processedAt', type: 'date', label: { tr: 'İşlenme zamanı', en: 'Processed at' }, admin: { date: { pickerAppearance: 'dayAndTime' } } },
  ]),
}
