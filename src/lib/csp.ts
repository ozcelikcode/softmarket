declare const __SOFTMARKET_E2E_BUILD__: boolean

/** Shared by middleware and config; no server-only dependencies (Edge compatible). */
export function contentSecurityPolicy({ nonce, admin = false, development = false, formActionExtra = [] }: {
  nonce?: string; admin?: boolean; development?: boolean
  /** Extra `form-action` sources; only the checkout path passes any (see `checkoutFormActionSources`). */
  formActionExtra?: readonly string[]
} = {}) {
  const scripts = admin ? "'unsafe-inline' 'unsafe-eval' blob:" : nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts}${development && !admin ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://*.cloudflareinsights.com${development ? ' ws: wss:' : ''}`,
    "frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'self'", `form-action 'self'${formActionExtra.map((source) => ` ${source}`).join('')}`, "frame-ancestors 'self'",
  ].join('; ') + ';'
}

/** Query-dependent listings preserve server filtering and are intentionally dynamic. */
export function usesNonce(pathname: string) {
  return /^\/(?:tr|en)\/(?:hesap|account|ara|search|iletisim|contact|demo-talep|request-demo|teklif-iste|request-quote|urunler|products|cozumler|solutions|haberler|news)\/?$/.test(pathname)
    || /^\/(?:tr|en)\/(?:hesap|account)(?:\/|$)/.test(pathname)
    || /^\/(?:tr|en)\/(?:destek|support)\/(?:indirmeler|downloads|dokumantasyon|documentation|surum-notlari|release-notes|sss|faq|talep|request|iletisim|contact)\/?$/.test(pathname)
}

/** Checkout page (TR/EN): the only path whose form may post to a payment provider (the 303 chain is checked too). */
export const isCheckoutPath = (pathname: string) => /^\/(?:tr|en)\/(?:hesap|account)\/(?:satin-al|checkout)(?:\/|$)/.test(pathname)

/**
 * `form-action` origins added on the checkout path ONLY, and only with the env capability (`PAYMENTS_ENABLED=true`).
 * Same host list as the provider adapters' redirect validation (iyzico: `iyzipay.com` / `iyzico.com` and subdomains;
 * Stripe: `checkout.stripe.com`, only while `PAYMENTS_STRIPE_ENABLED=true`). A loopback fake provider origin (isolated
 * e2e, never production) is added when `IYZICO_BASE_URL` points to it. Nothing else is relaxed: no script/frame/connect.
 */
export function checkoutFormActionSources(env: Record<string, string | undefined>): string[] {
  if (env.PAYMENTS_ENABLED !== 'true') return []
  const sources = ['https://iyzipay.com', 'https://*.iyzipay.com', 'https://iyzico.com', 'https://*.iyzico.com']
  if (env.PAYMENTS_STRIPE_ENABLED === 'true') sources.push('https://checkout.stripe.com')
  const localAllowed = env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || (typeof __SOFTMARKET_E2E_BUILD__ !== 'undefined' && __SOFTMARKET_E2E_BUILD__ && env.E2E_ISOLATED === '1')
  try {
    const url = new URL(env.IYZICO_BASE_URL?.trim() ?? '')
    if (localAllowed && ['127.0.0.1', 'localhost'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) sources.push(url.origin)
  } catch {
    // Not a URL: no local origin.
  }
  return sources
}
