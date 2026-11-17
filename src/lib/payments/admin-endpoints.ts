import type { PayloadRequest } from 'payload'

import { isAdminUser } from '@/access/roles'
import { sameOrigin } from '@/lib/portal/guard'
import { cancelOrder, refundOrder, resendNotifications, type AdminActionResult } from './admin-actions'
import { createPaymentsDeps, errorCode, type PaymentsDeps } from './runtime'

/*
 * P6 admin-only order endpoints (Payload collection endpoints, so they share Payload's auth):
 *   POST /api/orders/:id/refund   POST /api/orders/:id/cancel   POST /api/orders/:id/resend-notifications
 *
 * Access = an admin's PANEL SESSION only:
 *   anonymous 401 · customer 403 · editor 403 · users API key (and therefore MCP) 403 · JWT sent in an
 *   Authorization header 403 (not a browser panel session).
 * CSRF: Payload accepts the `payload-token` cookie from any origin when `csrf` is not configured, so these POSTs also
 * require a same-origin `Origin` (= Host, the Server Action rule) and, when the browser sends Fetch Metadata,
 * `Sec-Fetch-Site: same-origin`. SameSite=Lax already keeps the cookie off cross-site POSTs; this is defence in depth.
 * No request body is read: the order id is the only input; amount = order total (full refund, v1).
 * Responses are `no-store` JSON `{ code, status?, detail? }` with short codes only (no buyer data).
 */

type Guarded = { ok: true; actor: { id: number | string } } | { ok: false; response: Response }

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })

export function guardAdminSession(req: Pick<PayloadRequest, 'user' | 'headers'>): Guarded {
  const user = req.user as (PayloadRequest['user'] & { _strategy?: string }) | null | undefined
  if (!user) return { ok: false, response: json(401, { code: 'unauthorized' }) }
  if (!isAdminUser(user)) return { ok: false, response: json(403, { code: 'forbidden' }) }
  if (user._strategy !== 'local-jwt' || req.headers.get('authorization')) return { ok: false, response: json(403, { code: 'panel_session_required' }) }
  const site = req.headers.get('sec-fetch-site')
  if ((site && site !== 'same-origin') || !sameOrigin(req.headers).ok) return { ok: false, response: json(403, { code: 'cross_origin' }) }
  return { ok: true, actor: { id: user.id } }
}

export type AdminOrderAction = 'refund' | 'cancel' | 'resend-notifications'

const RUN: Record<AdminOrderAction, (deps: PaymentsDeps, id: number | string, actor: { id: number | string }) => Promise<AdminActionResult>> = {
  refund: refundOrder,
  cancel: cancelOrder,
  'resend-notifications': (deps, id) => resendNotifications(deps, id),
}

/** Test seam: deps factory (tests inject a fake provider layer and clock). */
export async function handleAdminOrderAction(
  req: PayloadRequest,
  action: AdminOrderAction,
  makeDeps: (req: PayloadRequest) => PaymentsDeps = (r) => createPaymentsDeps(r.payload),
): Promise<Response> {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const guard = guardAdminSession(req)
  if (!guard.ok) return guard.response
  const raw = String((req.routeParams as { id?: unknown } | undefined)?.id ?? '')
  if (!/^\d{1,12}$/.test(raw)) return json(404, { code: 'not_found' })
  const deps = makeDeps(req)
  try {
    const result = await RUN[action](deps, Number(raw), guard.actor)
    deps.log.info(`admin action=${action} order_id=${raw} code=${result.code}`)
    return json(result.http, { code: result.code, ...(result.status ? { status: result.status } : {}), ...(result.detail ? { detail: result.detail } : {}), ...(result.sent ? { sent: result.sent } : {}) })
  } catch (error) {
    deps.log.error(`admin action failed action=${action} order_id=${raw} code=${errorCode(error)}`)
    return json(500, { code: 'internal' })
  }
}
