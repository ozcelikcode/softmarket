import type { Where } from 'payload'

import { applyDispute, flagDisputeClosed, reconcileRefund } from './admin-actions'
import { readLimitedBody } from './body'
import { bodySha256, ORDER_NUMBER_RE, paymentEventKey } from './idempotency'
import { MAX_WEBHOOK_BYTES } from './providers/http'
import { errorCode, orderReturnPath, readWebhookWindow, type PaymentsDeps } from './runtime'
import { createPaymentEventStore } from './store/events'
import { syncOrderFromProvider } from './sync'
import type { ProviderId, VerifiedWebhookEvent } from './types'

/*
 * Provider notification + iyzico callback handlers (P4). Route files only wire these to Next.
 *
 * Webhook (plan §4.2 + S3 drain):
 *   capability off / adapter not configured        → 404 (no body read, no DB)
 *   outside the drain window, bad/oversized body    → 404 (the closed surface looks absent to probes)
 *   outside the window, VALID signature            → event recorded `ignored` (drain_closed), 200: the provider stops
 *                                                    retrying and the late notification stays visible to staff
 *   inside the window: body > 256 KB (counted while streaming) → 413, invalid UTF-8/signature → 400 (empty body)
 *   duplicate (already processed/ignored)           → 200
 *   unknown order                                   → `ignored` (unknown_order), 200
 *   retrieve/DB failure (incl. SQLITE_BUSY)          → `error` + 500 → provider retries; next delivery is reprocessed
 *   success                                         → `processed`, 200
 * Stripe verifies the raw body; iyzico parses its signed fields before checking their provider-defined signature.
 */

/**
 * P6: notifications that are not about the checkout session. Stripe only: iyzico documents no chargeback/dispute
 * or refund notification for Checkout Form payments (disputes arrive through the merchant panel / bank; staff then
 * suspend or revoke the licence in the admin). Unknown types fall through to the session sync (a no-op for them).
 */
export type ProviderEventKind = 'dispute_opened' | 'dispute_closed' | 'refunded' | 'payment'
export function classifyProviderEvent(event: Pick<VerifiedWebhookEvent, 'provider' | 'type'>): ProviderEventKind {
  if (event.provider !== 'stripe') return 'payment'
  if (event.type === 'charge.dispute.created') return 'dispute_opened'
  if (event.type === 'charge.dispute.closed') return 'dispute_closed'
  if (event.type === 'charge.refunded') return 'refunded'
  return 'payment'
}

const empty = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

type EventOrder = { id: number | string; orderNumber: string } | null

async function findOrderForEvent(deps: PaymentsDeps, event: VerifiedWebhookEvent): Promise<EventOrder> {
  const lookups: Where[] = []
  if (event.providerRef) lookups.push({ providerRef: { equals: event.providerRef } })
  if (event.orderNumber && ORDER_NUMBER_RE.test(event.orderNumber)) lookups.push({ orderNumber: { equals: event.orderNumber } })
  if (event.providerPaymentId) lookups.push({ providerPaymentId: { equals: event.providerPaymentId } })
  for (const where of lookups) {
    const { docs } = await deps.payload.find({
      collection: 'orders', where: { and: [{ provider: { equals: event.provider } }, where] }, limit: 1, depth: 0,
      overrideAccess: true, select: { orderNumber: true },
    })
    const doc = docs[0] as { id: number | string; orderNumber: string } | undefined
    if (doc) return doc
  }
  return null
}

export async function handleProviderWebhook(deps: PaymentsDeps, providerId: ProviderId, request: Request): Promise<Response> {
  const provider = deps.env.capability ? deps.providers[providerId] : undefined
  if (!provider) return empty(404)

  let inWindow: boolean
  try {
    inWindow = await readWebhookWindow(deps)
  } catch (error) {
    deps.log.error(`webhook window read failed provider=${providerId} code=${errorCode(error)}`)
    return empty(500)
  }

  const body = await readLimitedBody(request, MAX_WEBHOOK_BYTES)
  if (!body.ok) {
    deps.log.warn(`webhook rejected provider=${providerId} reason=${body.reason}`)
    if (!inWindow) return empty(404)
    return empty(body.reason === 'too_large' ? 413 : 400)
  }
  const verified = provider.verifyWebhook(body.text, request.headers, deps.now())
  if (!verified.ok) {
    deps.log.warn(`webhook rejected provider=${providerId} reason=${verified.reason}`)
    if (!inWindow) return empty(404)
    return empty(verified.reason === 'too_large' ? 413 : 400)
  }
  return empty(await processVerifiedEvent(deps, verified.event, bodySha256(body.text), inWindow))
}

/** Returns the HTTP status for an already verified notification. Exported for tests. */
export async function processVerifiedEvent(deps: PaymentsDeps, event: VerifiedWebhookEvent, sha256: string, inWindow: boolean): Promise<number> {
  const key = paymentEventKey(event.provider, event.eventId)
  if (!key) {
    deps.log.warn(`webhook rejected provider=${event.provider} reason=bad_event_id`)
    return 400
  }
  const events = createPaymentEventStore(deps.payload)
  let order: EventOrder
  try {
    order = await findOrderForEvent(deps, event)
    const fresh = await events.record({
      key, provider: event.provider, type: event.type.slice(0, 120), bodySha256: sha256, receivedAt: deps.now(), orderId: order?.id ?? null,
    })
    if (!fresh) {
      deps.log.info(`webhook duplicate provider=${event.provider} event=${event.eventId}`)
      return 200
    }
    if (!inWindow || !order) {
      // A charge event may precede the checkout sync that stores providerPaymentId. Keep it retryable.
      if (inWindow && !order && event.providerPaymentId && classifyProviderEvent(event) !== 'payment') {
        await events.mark(key, 'error', { failureCode: 'order_not_yet_linked' })
        return 500
      }
      const reason = !inWindow ? 'drain_closed' : 'unknown_order'
      await events.mark(key, 'ignored', { orderId: order?.id ?? null, failureCode: reason })
      deps.log.warn(`webhook ignored provider=${event.provider} event=${event.eventId} reason=${reason}${order ? ` order=${order.orderNumber}` : ''}`)
      return 200
    }
  } catch (error) {
    deps.log.error(`webhook record failed provider=${event.provider} event=${event.eventId} code=${errorCode(error)}`)
    return 500
  }

  try {
    const kind = classifyProviderEvent(event)
    if (kind !== 'payment') {
      if (kind === 'dispute_opened') await applyDispute(deps, order.id)
      else if (kind === 'dispute_closed') await flagDisputeClosed(deps, order.id)
      else {
        // Provider truth: refundStatus() decides; a refund made in the provider dashboard is finalised too.
        const result = await reconcileRefund(deps, order.id, 'provider')
        if (!['refunded', 'already_refunded', 'partially_refunded'].includes(result.code)) {
          throw new Error('payments:refund_not_yet_confirmed')
        }
      }
      await events.mark(key, 'processed', { orderId: order.id })
      deps.log.info(`webhook processed provider=${event.provider} event=${event.eventId} order=${order.orderNumber} kind=${kind}`)
      return 200
    }
    const outcome = await syncOrderFromProvider(deps, order.id)
    await events.mark(key, 'processed', { orderId: order.id })
    deps.log.info(`webhook processed provider=${event.provider} event=${event.eventId} order=${order.orderNumber} status=${outcome.status ?? 'unknown'}`)
    return 200
  } catch (error) {
    const code = errorCode(error)
    try {
      await events.mark(key, 'error', { orderId: order.id, failureCode: code })
    } catch {
      // The event stays `received`, which a redelivery also reprocesses.
    }
    deps.log.error(`webhook processing failed provider=${event.provider} event=${event.eventId} order=${order.orderNumber} code=${code}`)
    return 500
  }
}

// iyzico Checkout Form callback ------------------------------------------------------------------------------------

const CALLBACK_MAX_BYTES = 16 * 1024
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/

/** Static bilingual page: no request data echoed, no scripts, not indexable, not cacheable. */
export function callbackErrorPage(status: number): Response {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Ödeme / Payment</title></head><body style="font-family:Arial,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;line-height:1.6;color:#12161c;background:#fff"><h1 style="font-size:22px">Ödeme sonucu doğrulanamadı</h1><p>Ödemeniz alındıysa siparişiniz kısa süre içinde otomatik olarak güncellenir ve e-posta ile bilgilendirilirsiniz. Lütfen ödemeyi tekrar denemeden önce hesabınızdaki siparişleri kontrol edin.</p><p><a href="/tr/hesap">Hesabım</a></p><hr><h2 style="font-size:18px">The payment result could not be verified</h2><p>If your payment went through, your order is updated automatically shortly and you will receive an e-mail. Please check your orders before trying to pay again.</p><p><a href="/en/account">My account</a></p></body></html>`
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  })
}

/**
 * The customer's browser POSTs `token` here cross-site after the hosted page (plan §3/§4.2). No session cookie
 * arrives (SameSite=Lax) and none is needed: only the token is read, the body's payment status is never trusted,
 * the order is synced from a server-side retrieve, and the answer is always a 303 to the order list (a RELATIVE Location: the browser resolves it against the origin it just posted to, so no public-origin setting is involved) or a static
 * error page for a missing or malformed token). The account requires its usual authentication.
 */
export async function handleIyzicoCallback(deps: PaymentsDeps, request: Request): Promise<Response> {
  if (!deps.env.capability || !deps.providers.iyzico) return empty(404)
  let inWindow: boolean
  try {
    inWindow = await readWebhookWindow(deps)
  } catch (error) {
    deps.log.error(`callback window read failed code=${errorCode(error)}`)
    return callbackErrorPage(503)
  }
  if (!inWindow) return empty(404)

  const body = await readLimitedBody(request, CALLBACK_MAX_BYTES)
  const token = body.ok ? new URLSearchParams(body.text).get('token') : null
  if (!token || !TOKEN_RE.test(token)) {
    deps.log.warn(`callback rejected reason=${body.ok ? 'bad_token' : body.reason}`)
    return callbackErrorPage(400)
  }
  let orderId: number | string | undefined
  let orderLocale: string | undefined
  try {
    const { docs } = await deps.payload.find({
      collection: 'orders', where: { and: [{ provider: { equals: 'iyzico' } }, { providerRef: { equals: token } }] },
      limit: 1, depth: 0, overrideAccess: true, select: { orderNumber: true, locale: true },
    })
    orderId = (docs[0] as { id: number | string } | undefined)?.id
    orderLocale = (docs[0] as { locale?: string } | undefined)?.locale
  } catch (error) {
    deps.log.error(`callback lookup failed code=${errorCode(error)}`)
    return callbackErrorPage(503)
  }
  // Syntactically valid unknown tokens get the same redirect as known tokens.
  if (orderId === undefined) {
    deps.log.warn('callback rejected reason=unknown_token')
    return new Response(null, { status: 303, headers: { Location: orderReturnPath('tr'), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
  }
  try {
    const outcome = await syncOrderFromProvider(deps, orderId)
    deps.log.info(`callback synced order=${outcome.orderNumber ?? '?'} status=${outcome.status ?? 'unknown'}`)
  } catch (error) {
    // Webhook/reconcile complete it later; the order page shows the confirmed state only.
    deps.log.warn(`callback sync deferred code=${errorCode(error)}`)
  }
  return new Response(null, {
    status: 303,
    headers: { Location: orderReturnPath(orderLocale), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}
