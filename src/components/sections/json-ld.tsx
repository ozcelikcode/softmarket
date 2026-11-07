'use client'

import { useNonce } from '@/components/security/nonce-provider'
import { jsonLdString } from '@/lib/seo'

/**
 * Browsers blank the `nonce` attribute after parsing (nonce hiding), so the client always sees nonce="" while
 * the server markup carries the real value. Suppress that expected mismatch on this element only; the CSP is unchanged.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script nonce={useNonce()} suppressHydrationWarning type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
}
