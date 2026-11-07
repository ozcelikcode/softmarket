/** Shared by middleware and config; no server-only dependencies (Edge compatible). */
export function contentSecurityPolicy({ nonce, admin = false, development = false }: {
  nonce?: string; admin?: boolean; development?: boolean
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
    "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'",
  ].join('; ') + ';'
}

/** Query-dependent listings preserve server filtering and are intentionally dynamic. */
export function usesNonce(pathname: string) {
  return /^\/(?:tr|en)\/(?:hesap|account|ara|search|iletisim|contact|demo-talep|request-demo|teklif-iste|request-quote|urunler|products|cozumler|solutions|haberler|news)\/?$/.test(pathname)
    || /^\/(?:tr|en)\/(?:hesap|account)(?:\/|$)/.test(pathname)
    || /^\/(?:tr|en)\/(?:destek|support)\/(?:indirmeler|downloads|dokumantasyon|documentation|surum-notlari|release-notes|sss|faq|talep|request|iletisim|contact)\/?$/.test(pathname)
}
