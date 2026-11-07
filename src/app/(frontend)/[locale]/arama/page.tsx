import { permanentRedirect } from 'next/navigation'
import { localizedHref } from '@/i18n/paths'
import { initLocale } from '@/lib/page-utils'
import type { Query } from '@/lib/support-query'

/** Middleware handles public requests; keep the same semantics for direct rendering. */
export default async function LegacySearch({ params, searchParams }: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Query>
}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, item)
  }
  const suffix = query.size ? `?${query}` : ''
  permanentRedirect(localizedHref(`/ara${suffix}`, await initLocale(params)))
}
