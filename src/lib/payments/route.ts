import { loadPaymentsConfig } from '../integrations/runtime'
import { readCapability } from './mode'
import { handleIyzicoCallback, handleProviderWebhook } from './events'
import { createPaymentsDeps } from './runtime'

/*
 * Next route wiring for /api/payments/** (Node runtime, never cached). Without the env capability the route answers
 * 404 before Payload or the database is touched (plan §1.1 layer 1). These routes live under /api, which the
 * middleware matcher excludes: the Server Action origin guard and the page CSP never apply to them, and they accept
 * only POST (Next answers 405 for other methods).
 */

type Kind = 'iyzico-webhook' | 'stripe-webhook' | 'iyzico-callback'

export function paymentsRoute(kind: Kind) {
  return async function POST(request: Request): Promise<Response> {
    // Capability off: 404 before Payload or the database is touched.
    if (!readCapability(process.env)) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
    const payload = await getPayload({ config })
    // Credentials: env first, else the admin panel (integrations, decrypted in memory).
    const env = await loadPaymentsConfig(payload)
    if (!env.capability || (kind === 'stripe-webhook' ? !env.stripe : !env.iyzico)) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }
    const deps = createPaymentsDeps(payload, { env })
    if (kind === 'iyzico-callback') return handleIyzicoCallback(deps, request)
    return handleProviderWebhook(deps, kind === 'stripe-webhook' ? 'stripe' : 'iyzico', request)
  }
}
