const fallback = 'http://127.0.0.1:3100'

export function serverUrl(value = process.env.NEXT_PUBLIC_SERVER_URL): string {
  try {
    const url = new URL(value || fallback)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return fallback
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return fallback
    return url.origin
  } catch {
    return fallback
  }
}

/** Validate once at Next build/start; local production builds warn but remain usable. */
export function validateServerUrl() {
  if (process.env.NODE_ENV !== 'production') return
  const value = process.env.NEXT_PUBLIC_SERVER_URL
  const origin = serverUrl(value)
  if (!value || origin === fallback) {
    console.warn('[SEO] NEXT_PUBLIC_SERVER_URL must be a public http(s) origin in production. Canonical/hreflang currently use http://127.0.0.1:3100; configure the deployment domain before publishing.')
  }
}
