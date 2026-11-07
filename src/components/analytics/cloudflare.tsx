'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function analyticsAllowed(pathname: string) {
  const path = pathname.replace(/^\/(tr|en)(?=\/|$)/, '')
  return !/^\/(admin|api|hesap|account)(?:\/|$)/.test(path)
}

export function CloudflareAnalytics({ token }: { token?: string }) {
  const pathname = usePathname()
  const [security, setSecurity] = useState<{ nonce?: string } | null>(null)
  useEffect(() => {
    setSecurity({ nonce: document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce })
  }, [])
  if (!security || !token?.trim() || !analyticsAllowed(pathname)) return null
  return <CloudflareBeacon token={token.trim()} nonce={security.nonce} />
}

/** Render only after the document nonce is known; external scripts keep the same nonce across SPA navigation. */
export function CloudflareBeacon({ token, nonce }: { token: string; nonce?: string }) {
  return (
    <Script
      nonce={nonce}
      id="cloudflare-web-analytics"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      defer
      // Do not retain SPA route tracking when navigating into the customer portal.
      data-cf-beacon={JSON.stringify({ token: token.trim(), spa: false })}
    />
  )
}
