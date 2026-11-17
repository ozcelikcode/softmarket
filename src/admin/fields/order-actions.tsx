import type { UIFieldServerComponent } from 'payload'

import { isAdminUser } from '@/access/roles'
import { formatMoney, isCurrency } from '@/lib/payments/format'
import { OrderActionsClient } from './order-actions-client'

/*
 * P6 order document sidebar: "İade et" / "İptal et" / "Bildirimi yeniden gönder" (a `ui` field: no column, no schema).
 * Rendered only for an admin's panel session (editors, API keys see nothing; the endpoints enforce the same rule).
 * Server component: decides which actions apply from the SAVED order; the client part only confirms and POSTs to
 * /api/orders/:id/<action> (admin-endpoints.ts) and receives short codes. No buyer data is passed to the client.
 */

const NOTIFY_MAX_ATTEMPTS = 5

export const OrderActions: UIFieldServerComponent = ({ req, id, data, i18n }) => {
  const user = req?.user as (typeof req.user & { _strategy?: string }) | null | undefined
  if (!isAdminUser(user) || user?._strategy !== 'local-jwt' || id === undefined || id === null) return null
  const lang = i18n?.language === 'en' ? 'en' : 'tr'
  const doc = (data ?? {}) as {
    status?: string
    currency?: string
    totalMinor?: number
    notifications?: { attempts?: number | null; lastError?: string | null } | null
  }
  const status = doc.status ?? 'pending'
  const total = isCurrency(doc.currency) && typeof doc.totalMinor === 'number' ? formatMoney(doc.totalMinor, doc.currency, lang) : ''
  const attempts = doc.notifications?.attempts ?? 0
  return (
    <OrderActionsClient
      orderId={String(id)}
      lang={lang}
      total={total}
      status={status}
      canRefund={status === 'paid' || status === 'fulfilled'}
      canCancel={status === 'pending'}
      canResend={attempts >= NOTIFY_MAX_ATTEMPTS || Boolean(doc.notifications?.lastError)}
    />
  )
}
