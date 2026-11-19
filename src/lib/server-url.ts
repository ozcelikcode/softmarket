const fallback = 'http://127.0.0.1:3100'
const loopbackHosts = ['localhost', '127.0.0.1', '[::1]']

export function serverUrl(value = process.env.NEXT_PUBLIC_SERVER_URL): string {
  try {
    const url = new URL(value || fallback)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return fallback
    if (loopbackHosts.includes(url.hostname)) return fallback
    return url.origin
  } catch {
    return fallback
  }
}

/** Cookie auth uses the actual site origin, including its port on an isolated server. */
export function payloadSessionConfig(env = process.env) {
  let origin: URL | undefined
  try {
    const url = new URL(env.NEXT_PUBLIC_SERVER_URL ?? '')
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) origin = url
  } catch {
    // Missing or invalid configuration uses the default local origin.
  }
  const site = origin ?? new URL(fallback)
  const localHttp = site.protocol === 'http:' && loopbackHosts.includes(site.hostname)
  // A loopback server answers under every loopback alias (the docs use 127.0.0.1, `.env` often localhost).
  const csrf = localHttp
    ? loopbackHosts.map((host) => `http://${host}${site.port ? `:${site.port}` : ''}`)
    : [site.origin]
  return {
    csrf,
    // Secure everywhere except plain-HTTP loopback (local dev, `next start` and isolated e2e servers).
    cookies: { sameSite: 'Lax' as const, secure: site.protocol === 'https:' || (env.NODE_ENV === 'production' && !(origin && localHttp)) },
  }
}

/** Canonical browser origin for a server request. Caddy preserves the public Host. */
export function originForHost(host: string | null, protocol: string): string | null {
  if (!host || /[\s/\\@?#]/.test(host) || (protocol !== 'http:' && protocol !== 'https:')) return null
  try {
    return new URL(`${protocol}//${host}`).origin
  } catch {
    return null
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
