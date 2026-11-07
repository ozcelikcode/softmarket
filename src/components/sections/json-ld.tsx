'use client'

import { useNonce } from '@/components/security/nonce-provider'
import { jsonLdString } from '@/lib/seo'

export function JsonLd({ data }: { data: unknown }) {
  return <script nonce={useNonce()} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
}
