import { cache } from 'react'
import { unstable_noStore } from 'next/cache'

import { closedCommerceState, computeCommerceState, type CommerceState } from '@/lib/payments/commerce-state'
import { readCapability } from '@/lib/payments/mode'

/**
 * The ONE entry point every payment-facing surface asks (plan §1.1): product page, JSON-LD, footer/legal
 * filter, sitemap. Env and the site-settings commerce group are never read elsewhere for visibility.
 *
 * Fail-closed: without the env capability the DB is not touched (zero extra queries on a quote-only install);
 * any read error returns the closed state (quote only). Per-request memoisation only.
 * Open payment surfaces must never enter the shared HTML/RSC cache: cached prices/legal pages would otherwise
 * bypass this gate after an env/provider change or a process restart. Quote-only pages retain their existing ISR.
 */
export const getCommerceState = cache(async (): Promise<CommerceState> => {
  if (!readCapability(process.env)) return closedCommerceState()
  let state: CommerceState
  try {
    // Lazy: `site.ts` imports this module (footer/header link filter), and Payload config loads only when needed.
    const payload = await (await import('@/lib/site')).getPayloadClient()
    // Staff-only fields: server read with overrideAccess, projected to the commerce group, never sent to clients.
    const siteSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, select: { commerce: true } })
    state = computeCommerceState({ env: process.env, siteSettings })
  } catch {
    return closedCommerceState()
  }
  // Outside the catch: Next's static-render bailout must propagate, rather than masquerade as a DB failure.
  if (state.open) unstable_noStore()
  return state
})
