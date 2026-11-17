import type { Payload } from 'payload'

import { formatMoney, isCurrency } from '@/lib/payments/format'
import { orderPagePath } from '@/lib/payments/runtime'
import type { BuyerEmailOutcome, NotifyOrder } from './order-confirmation'
import { emailTemplate, isSmtpConfigured } from './template'

/*
 * Buyer e-mail for a refunded order (P6). Called ONLY by the durable order notification queue
 * (src/lib/payments/notify.ts, kind `refund`), which records the "sent" marker on the order's refund-notice journal
 * row, so the message goes out once. Same rules as the other order e-mails: no SMTP → nothing is sent (the console
 * adapter would print the recipient), a transport error is thrown and never logged with its message.
 */

const idOf = (value: number | { id: number } | null | undefined) => (value && typeof value === 'object' ? value.id : value)

export async function sendOrderRefunded(payload: Payload, order: NotifyOrder, ctx: { origin: string }): Promise<BuyerEmailOutcome> {
  if (!isSmtpConfigured()) return 'no_smtp'
  const customerId = idOf(order.customer) ?? undefined
  const customer = customerId
    ? ((await payload.findByID({ collection: 'customers', id: customerId, depth: 0, overrideAccess: true, disableErrors: true })) as { email?: string } | null)
    : null
  const to = customer?.email || order.billing?.email || undefined
  if (!to) return 'no_recipient'
  const en = order.locale === 'en'
  const locale = en ? 'en' : 'tr'
  const item = order.items?.[0]
  const total = isCurrency(order.currency) && typeof order.totalMinor === 'number' ? formatMoney(order.totalMinor, order.currency, locale) : ''
  const subject = en ? `Order ${order.orderNumber} refunded` : `${order.orderNumber} numaralı siparişiniz iade edildi`
  const body = en
    ? 'The full amount of your order has been refunded to your payment method. The license assigned with this order has been revoked. Depending on your bank, the refund may take a few business days to appear.'
    : 'Siparişinizin tutarının tamamı ödeme yönteminize iade edildi. Bu siparişle atanan lisans iptal edildi. Bankanıza bağlı olarak iadenin hesabınıza yansıması birkaç iş günü sürebilir.'
  const rows: [string, string][] = [
    [en ? 'Order number' : 'Sipariş no', order.orderNumber],
    [en ? 'Edition' : 'Sürüm', [item?.title, item?.sku ? `(${item.sku})` : ''].filter(Boolean).join(' ')],
    [en ? 'Refunded amount' : 'İade tutarı', total],
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
