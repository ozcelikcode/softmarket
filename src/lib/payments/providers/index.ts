import type { PaymentsEnvConfig } from '../env'
import type { FetchLike, PaymentProvider, ProviderId } from '../types'
import { createIyzicoProvider } from './iyzico'
import { createStripeProvider } from './stripe'

/**
 * Builds the configured providers from env config. Admin on/off switches (site-settings, P2-S)
 * are applied by the caller; a provider missing here is "not configured" and therefore unavailable.
 * Not wired to any route in P1.
 */
export function createConfiguredProviders(
  cfg: PaymentsEnvConfig,
  fetchImpl: FetchLike,
): Partial<Record<ProviderId, PaymentProvider>> {
  const providers: Partial<Record<ProviderId, PaymentProvider>> = {}
  if (!cfg.capability) return providers
  if (cfg.iyzico) providers.iyzico = createIyzicoProvider({ config: cfg.iyzico, fetch: fetchImpl })
  if (cfg.stripe) providers.stripe = createStripeProvider({ config: cfg.stripe, fetch: fetchImpl })
  return providers
}
