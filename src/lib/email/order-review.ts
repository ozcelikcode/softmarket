import type { Payload } from 'payload'

import { isEmailConfigured } from './adapter'
import { emailTemplate } from './template'

/*
 * Staff alert (P4): an order was flagged `requiresReview` (amount/currency/reference mismatch, late payment). No
 * licence is issued for it. The message carries the order number, a short reason code and the admin link only:
 * no buyer data. Recipient: PAYMENTS_ALERT_EMAIL (env); SMTP from env or the admin panel (integrations). Called only by the order notification queue
 * (src/lib/payments/notify.ts), which records a durable "sent" marker. Without a recipient or SMTP it returns
 * `not_configured` (the queue logs the order number and reason only); a transport error is thrown.
 */

export const alertRecipient = (env: Record<string, string | undefined> = process.env) => {
  const to = env.PAYMENTS_ALERT_EMAIL?.trim()
  return to && !to.startsWith('CHANGE_') ? to : null
}

export async function sendOrderReviewAlert(
  payload: Payload,
  input: { orderId: number | string; orderNumber: string; reason: string },
  ctx: { origin: string; env?: Record<string, string | undefined> },
): Promise<'sent' | 'not_configured'> {
  const to = alertRecipient(ctx.env ?? process.env)
  if (!to || !(await isEmailConfigured(payload, ctx.env ?? process.env))) return 'not_configured'
  const subject = `Sipariş incelemesi gerekiyor / Order needs review: ${input.orderNumber}`
  const body = 'Lisans otomatik atanmadı. Siparişi ve sağlayıcı panelini kontrol edin. / No license was assigned automatically. Check the order and the provider dashboard.'
  const rows: [string, string][] = [
    ['Sipariş no / Order', input.orderNumber],
    ['Sebep / Reason', input.reason],
  ]
  const url = `${ctx.origin}/admin/collections/orders/${encodeURIComponent(String(input.orderId))}`
  await payload.sendEmail({
    to,
    subject,
    text: `${subject}\n\n${body}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale: 'tr', title: subject, body, rows, action: { label: 'Yönetim paneli / Admin', url } }),
  })
  return 'sent'
}
