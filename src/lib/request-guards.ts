/** Reject untrusted action requests before Next's action handler throws a 500. */
export function forbiddenActionOrigin(method: string, headers: Headers): boolean {
  if (method !== 'POST' || !headers.has('next-action')) return false
  try {
    const origin = new URL(headers.get('origin') || '')
    // Compare the actual request host; never accept arbitrary forwarded hosts.
    return !['http:', 'https:'].includes(origin.protocol) || origin.host !== headers.get('host')
  } catch {
    return true
  }
}

export function legacySearchPath(pathname: string): string | null {
  const match = pathname.match(/^\/(tr|en)\/arama\/?$/)
  if (match) return match[1] === 'en' ? '/en/search' : '/tr/ara'
  return pathname === '/arama' || pathname === '/arama/' ? '/tr/ara' : null
}
