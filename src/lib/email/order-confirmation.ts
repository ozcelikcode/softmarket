import type { Payload } from 'payload'

import { formatMoney, isCurrency } from '@/lib/payments/format'
import { orderPagePath } from '@/lib/payments/runtime'
import { buildLicenseEmail } from './license-assigned'
import { isEmailConfigured } from './adapter'
import { emailTemplate } from './template'

/*
 * Buyer e-mails of a fulfilled order (P4). Called ONLY by the order notification queue (src/lib/payments/notify.ts),
 * which holds a per-order delivery lease and records a durable "sent" marker after each successful send, so every
 * message goes out once (also from the reconcile CLI, where next/server `after()` is unavailable).
 *   - sendOrderConfirmation: payment received + link to the order page.
 *   - sendOrderLicenses: the licence key(s) issued for the order (same layout as the manual assignment e-mail).
 *
 * Without SMTP nothing is sent (plan §4.5: Payload's console adapter would print the recipient and body, licence
 * key included). Callers check SMTP first; the check here is a second guard. Return values are short codes; a
 * transport error is thrown (its message is never logged or stored).
 */

export type BuyerEmailOutcome = 'sent' | 'no_smtp' | 'no_recipient' | 'no_license'

export type NotifyOrder = {
  id: number | string
  orderNumber: string
  locale?: string | null
  currency?: string | null
  totalMinor?: number | null
  customer?: number | { id: number } | null
  billing?: { email?: string | null } | null
  items?: { title?: string | null; sku?: string | null; license?: number | { id: number } | null }[] | null
}

const idOf = (value: number | { id: number } | null | undefined) => (value && typeof value === 'object' ? value.id : value)

async function recipient(payload: Payload, order: NotifyOrder): Promise<{ to?: string; customerId?: number }> {
  const customerId = idOf(order.customer) ?? undefined
  const customer = customerId
    ? ((await payload.findByID({ collection: 'customers', id: customerId, depth: 0, overrideAccess: true, disableErrors: true })) as { email?: string } | null)
    : null
  return { to: customer?.email || order.billing?.email || undefined, customerId }
}

export async function sendOrderConfirmation(payload: Payload, order: NotifyOrder, ctx: { origin: string }): Promise<BuyerEmailOutcome> {
  if (!(await isEmailConfigured(payload))) return 'no_smtp'
  const { to } = await recipient(payload, order)
  if (!to) return 'no_recipient'
  const en = order.locale === 'en'
  const locale = en ? 'en' : 'tr'
  const item = order.items?.[0]
  const total = isCurrency(order.currency) && typeof order.totalMinor === 'number' ? formatMoney(order.totalMinor, order.currency, locale) : ''
  const subject = en ? `Order ${order.orderNumber} confirmed` : `${order.orderNumber} numaralı siparişiniz onaylandı`
  const body = en
    ? 'Your payment has been received and your license has been assigned. You can view your license key in your account.'
    : 'Ödemeniz alındı ve lisansınız atandı. Lisans anahtarınızı hesabınızda görüntüleyebilirsiniz.'
  const rows: [string, string][] = [
    [en ? 'Order number' : 'Sipariş no', order.orderNumber],
    [en ? 'Edition' : 'Sürüm', [item?.title, item?.sku ? `(${item.sku})` : ''].filter(Boolean).join(' ')],
    [en ? 'Total' : 'Toplam', total],
  ]
  const url = `${ctx.origin}${orderPagePath(locale, order.orderNumber)}`
  await payload.sendEmail({
    to,
    subject,
    text: `${subject}\n\n${body}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale, title: subject, body, rows, action: { label: en ? 'View order' : 'Siparişi görüntüle', url } }),
  })
  return 'sent'
}

/** One e-mail with every licence linked to the order's items (only licences owned by the order's customer). */
export async function sendOrderLicenses(payload: Payload, order: NotifyOrder): Promise<BuyerEmailOutcome> {
  if (!(await isEmailConfigured(payload))) return 'no_smtp'
  const licenseIds = [...new Set((order.items ?? []).map((item) => idOf(item.license)).filter((id): id is number => typeof id === 'number'))]
  if (!licenseIds.length) return 'no_license'
  const { to, customerId } = await recipient(payload, order)
  if (!to) return 'no_recipient'
  const licenses = []
  for (const id of licenseIds) {
    const license = await payload.findByID({ collection: 'licenses', id, depth: 0, overrideAccess: true, disableErrors: true })
    if (!license || idOf(license.customer) !== customerId) return 'no_license'
    licenses.push(license)
  }
  const message = await buildLicenseEmail(payload, licenses, order.locale === 'en' ? 'en' : 'tr')
  await payload.sendEmail({ to, ...message })
  return 'sent'
}
