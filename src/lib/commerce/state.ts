import { cache } from 'react'
import { unstable_noStore } from 'next/cache'

import { readLegalFacts } from '@/lib/commerce/legal-facts'
import { closedCommerceState, computeCommerceState, type CommerceState } from '@/lib/payments/commerce-state'
import { evaluateLegal } from '@/lib/payments/legal'
import { readCapability } from '@/lib/payments/mode'

/**
 * `PAYMENTS_ENABLED` as seen by `next build`/`next dev` (webpack DefinePlugin in next.config.ts). Undefined outside a
 * Next bundle (vitest, tsx CLIs): those have no prerendered routes, so the runtime env alone decides there.
 */
declare const __SOFTMARKET_BUILD_PAYMENTS__: boolean
const builtWithoutCapability = () => typeof __SOFTMARKET_BUILD_PAYMENTS__ !== 'undefined' && !__SOFTMARKET_BUILD_PAYMENTS__

/** Next's static-render bailout (thrown by `unstable_noStore()` etc.) carries this digest. */
const isStaticBailout = (error: unknown) => (error as { digest?: unknown } | null)?.digest === 'DYNAMIC_SERVER_USAGE'
let warnedPrerendered = false

/**
 * The ONE entry point every payment-facing surface asks (plan §1.1): product page, JSON-LD, footer/legal
 * filter, sitemap. Env and the site-settings commerce group are never read elsewhere for visibility.
 *
 * `open` includes `legalReady` (P7): published, non-draft sales legal pages marked with `pages.commerceLegal`.
 * Fail-closed: without the env capability the DB is not touched (zero extra queries on a quote-only install and the
 * existing ISR is untouched); any read error returns the closed state (quote only). Per-request memoisation only.
 *
 * Caching (P5): with the env capability ON every consumer opts out of the shared HTML/RSC cache, whatever the site
 * mode. The mode lives in the DB and flips at runtime; a route that was prerendered while the mode was `quote-only`
 * could otherwise not become dynamic later (Next answers 500 `DYNAMIC_SERVER_USAGE` on the next revalidation) and
 * cached prices/legal pages would bypass this gate. At BUILD time the bailout is rethrown on purpose: it marks the
 * routes dynamic, so the build environment must carry `PAYMENTS_ENABLED=true`. If a build prerendered without the
 * capability and the process later starts with it, the bailout cannot happen at runtime: the state then fails closed
 * (quote only, site stays up) until the site is rebuilt.
 */
const warnPrerendered = () => {
  if (warnedPrerendered) return
  warnedPrerendered = true
  console.warn('[payments] PAYMENTS_ENABLED is on but this build was prerendered without it: payments stay hidden (quote only). Rebuild with PAYMENTS_ENABLED=true.')
}

/**
 * Render-mode boundary (P6 fix for "Page changed from static to dynamic at runtime"). Returns true when this render
 * may read the commerce state. With the capability ON (build and runtime) it opts the WHOLE route out of the static
 * cache: called unconditionally by the frontend locale layout, so every page under it is dynamic from the build on,
 * whatever data a page later meets (a sales legal page created after the build, a footer link to one). Calling it
 * only on some data paths left routes prerendered as static, and the first runtime render that reached
 * `unstable_noStore()` set revalidate=0, which Next 15 answers with that error / HTTP 500 (the catch below cannot
 * undo it). Capability OFF: no-op, ISR unchanged. Built without it but started with it: the opt-out is NOT attempted
 * (it would 500 every prerendered route); the state stays closed (quote only) until a rebuild.
 */
export function commerceRenderBoundary(): boolean {
  if (!readCapability(process.env)) return false
  if (builtWithoutCapability()) {
    warnPrerendered()
    return false
  }
  try {
    unstable_noStore()
  } catch (error) {
    if (process.env.NEXT_PHASE === 'phase-production-build' || !isStaticBailout(error)) throw error
    warnPrerendered()
    return false
  }
  return true
}

/**
 * True while building/serving with the payments capability (the build constant agrees). Used by
 * `contentStaticParams`: such a build must prerender NO content path, otherwise a route whose param list happened to
 * be empty at build time (e.g. sales legal pages written after the build) stays an ISR fallback route and its first
 * runtime render hits the boundary above → "Page changed from static to dynamic at runtime" (HTTP 500).
 */
export function commerceDynamicBuild(): boolean {
  return readCapability(process.env) && !builtWithoutCapability()
}

export const getCommerceState = cache(async (): Promise<CommerceState> => {
  if (!commerceRenderBoundary()) return closedCommerceState()
  try {
    // Lazy: `site.ts` imports this module (footer/header link filter), and Payload config loads only when needed.
    const payload = await (await import('@/lib/site')).getPayloadClient()
    // Staff-only fields: server read with overrideAccess, projected to the commerce group, never sent to clients.
    const siteSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, select: { commerce: true } })
    // Legal pages are read only when everything else would open the surface (no extra query otherwise).
    const base = computeCommerceState({ env: process.env, siteSettings, legalReady: true })
    const legalReady = base.open && evaluateLegal(await readLegalFacts(payload)).ready
    return computeCommerceState({ env: process.env, siteSettings, legalReady })
  } catch {
    return closedCommerceState()
  }
})
