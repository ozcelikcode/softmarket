import { after } from 'next/server'
import type { Payload } from 'payload'

import { serverUrl } from '../server-url'
import { readPaymentsEnv, type PaymentsEnvConfig } from './env'
import { PaymentError } from './errors'
import { isWebhookProcessingAllowed, readSiteMode } from './mode'
import { createConfiguredProviders } from './providers'
import { PaymentTransactionError } from './store/transaction'
import type { FetchLike, PaymentProvider, ProviderId } from './types'

/*
 * P4 server runtime for provider notifications, the iyzico callback and the reconcile job. SERVER ONLY: imported by
 * route handlers under src/app/(payload)/api/payments and by scripts/payments-reconcile.ts; never by a client
 * component (tests/unit/payments-p4.test.ts walks the client import graph).
 *
 * Everything external is injected (Payload, env config, fetch, clock, post-response scheduling) so tests run the
 * full flow on a temporary SQLite database with a fake provider HTTP layer and no network.
 */

/** Messages are fixed strings plus order numbers / short codes only: never e-mail, TCKN/VKN, address, keys, bodies. */
export type PaymentsLogger = { info(message: string): void; warn(message: string): void; error(message: string): void }

export type PaymentsDeps = {
  payload: Payload
  env: PaymentsEnvConfig
  /** Env-configured adapters (empty when the capability is off). Admin on/off switches only gate NEW checkouts. */
  providers: Partial<Record<ProviderId, PaymentProvider>>
  now: () => Date
  /** Runs a side effect (e-mail) after the response; errors are logged, never thrown. */
  defer: (task: () => Promise<void>) => void
  log: PaymentsLogger
  /** Public origin for redirects and e-mail links. */
  origin: string
}

export function paymentsLogger(payload: Payload): PaymentsLogger {
  return {
    info: (message) => payload.logger.info(`payments: ${message}`),
    warn: (message) => payload.logger.warn(`payments: ${message}`),
    error: (message) => payload.logger.error(`payments: ${message}`),
  }
}

/** Schedules with next/server `after()` inside a request; outside one (CLI) the task starts immediately. */
export function deferAfterResponse(log: PaymentsLogger): PaymentsDeps['defer'] {
  return (task) => {
    const guarded = async () => {
      try {
        await task()
      } catch {
        log.error('post-commit task failed')
      }
    }
    try {
      after(guarded)
    } catch {
      void guarded()
    }
  }
}

export function createPaymentsDeps(payload: Payload, overrides: Partial<Omit<PaymentsDeps, 'payload'>> & { fetch?: FetchLike } = {}): PaymentsDeps {
  const env = overrides.env ?? readPaymentsEnv(process.env)
  const log = overrides.log ?? paymentsLogger(payload)
  return {
    payload,
    env,
    providers: overrides.providers ?? createConfiguredProviders(env, overrides.fetch ?? (globalThis.fetch as unknown as FetchLike)),
    now: overrides.now ?? (() => new Date()),
    defer: overrides.defer ?? deferAfterResponse(log),
    log,
    origin: overrides.origin ?? serverUrl(),
  }
}

/**
 * S3 drain window for notifications and the callback: capability on AND (site mode `payments` OR within 72 h of
 * `commerce.quoteSince`). Read from the DB on every notification (no cache: the switch must take effect at once).
 */
export async function readWebhookWindow(deps: Pick<PaymentsDeps, 'payload' | 'env' | 'now'>): Promise<boolean> {
  if (!deps.env.capability) return false
  const settings = await deps.payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, select: { commerce: true } })
  const commerce = (settings as { commerce?: { quoteSince?: unknown } } | null)?.commerce
  return isWebhookProcessingAllowed({ capability: true, siteMode: readSiteMode(settings), quoteSince: commerce?.quoteSince, now: deps.now() })
}

/**
 * Customer order page (P5 route `/hesap/siparisler/<no>` ↔ `/account/orders/<no>`). Until P5 ships the route is not
 * rendered, but no checkout can start either (`checkoutReady` is false), so nobody is redirected here yet.
 */
export function orderPagePath(locale: unknown, orderNumber: string): string {
  return locale === 'en' ? `/en/account/orders/${encodeURIComponent(orderNumber)}` : `/tr/hesap/siparisler/${encodeURIComponent(orderNumber)}`
}

/** Short, log-safe code for any processing error (never the message of a foreign error). */
export function errorCode(error: unknown): string {
  if (error instanceof PaymentError) return error.code
  if (error instanceof PaymentTransactionError) return error.code
  const text = error instanceof Error ? `${error.name} ${error.message} ${String((error as { code?: unknown }).code ?? '')}` : ''
  if (/SQLITE_BUSY|database is locked|write queue timeout/i.test(text)) return 'db_busy'
  if (error instanceof Error && error.name === 'SyncConflict') return 'sync_conflict'
  if (error instanceof Error && error.name === 'FulfillmentFailed') return 'fulfillment_conflict'
  return 'internal'
}
