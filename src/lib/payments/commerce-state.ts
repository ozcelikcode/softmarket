import { readPaymentsEnv } from './env'
import { CHECKOUT_READY } from './flags'
import { readCapability, resolveCommerceGate, type CommerceGate, type SiteCommerceMode } from './mode'
import { readVatSettings } from './settings'
import type { VatRule } from './tax'
import type { Currency, ProviderId } from './types'

/**
 * Commerce state (plan §1.1), pure and fail-closed. Inputs are `unknown`; anything missing, malformed or
 * unconfigured reads as "quote only". The server loader (`src/lib/commerce/state.ts`) only feeds it env + the
 * stored site-settings; every payment surface asks that loader, never env or the global directly.
 *
 *   open = capability (env PAYMENTS_ENABLED) AND site mode `payments` AND >= 1 provider (enabled in settings AND
 *          configured in env) AND >= 1 currency with a VAT rule.
 *   checkoutOpen = open AND checkoutReady (P5 flag): only then a "Buy" action may link to a checkout.
 *
 * `legalReady` (three published, non-draft sales pages) joins `open` with the P7 legal texts; until then the
 * admin readiness list reports it but it does not block.
 */
export type CommerceState = {
  capability: boolean
  siteMode: SiteCommerceMode
  gate: CommerceGate
  availableProviders: ProviderId[]
  stripeEnabled: boolean
  stripeCurrencies: Currency[]
  vatSettings: Partial<Record<Currency, VatRule>>
  /** Payments surface visible: prices, buy actions, sales legal pages, JSON-LD offers. */
  open: boolean
  checkoutReady: boolean
  /** A buy action may link to checkout. */
  checkoutOpen: boolean
}

const prop = (obj: unknown, key: string): unknown =>
  obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined

export function computeCommerceState(input: {
  env: Record<string, string | undefined>
  siteSettings: unknown
  checkoutReady?: boolean
}): CommerceState {
  const env = readPaymentsEnv(input.env)
  const gate = resolveCommerceGate({ env: input.env, siteSettings: input.siteSettings })
  const enabled = (id: ProviderId) => prop(prop(prop(prop(input.siteSettings, 'commerce'), 'providers'), id), 'enabled') === true
  const availableProviders: ProviderId[] = []
  if (enabled('iyzico') && env.iyzico) availableProviders.push('iyzico')
  if (enabled('stripe') && env.stripe) availableProviders.push('stripe')
  const vatSettings = readVatSettings(input.siteSettings)
  const open = readCapability(input.env) && gate.checkoutOpen && availableProviders.length > 0 && Object.keys(vatSettings).length > 0
  const checkoutReady = input.checkoutReady ?? CHECKOUT_READY
  return {
    capability: gate.capability,
    siteMode: gate.siteMode,
    gate,
    availableProviders,
    stripeEnabled: availableProviders.includes('stripe'),
    stripeCurrencies: env.stripeCurrencies,
    vatSettings,
    open,
    checkoutReady,
    checkoutOpen: open && checkoutReady,
  }
}

/** Everything off: the state used on any read failure and whenever the env capability is missing. */
export const closedCommerceState = (): CommerceState => computeCommerceState({ env: {}, siteSettings: null })
