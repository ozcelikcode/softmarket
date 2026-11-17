import { cache } from 'react'
import { commerceDynamicBuild } from './commerce/state'
import { getSitemapEntries } from './content'
import { getSupportSitemapEntries } from './support'
const entries = cache(async () => (await Promise.all([getSitemapEntries(), getSupportSitemapEntries()])).flat())

/** Reserved value of the build-time probe path (never a real slug: underscores are not produced by slugify). */
export const DYNAMIC_PROBE = '__dynamic__'

export async function contentStaticParams(template: string, parent: Record<string, string> = {}) {
  const segments = template.split('/')
  if (commerceDynamicBuild()) {
    // Payments capability: every page under the locale layout is per-request (commerceRenderBoundary). One probe path
    // per route makes the build render it, hit the boundary and mark the ROUTE dynamic; a real list could be empty
    // (no render → ISR fallback route → runtime "static to dynamic" 500). The probe itself is never served (404).
    const row: Record<string, string> = { locale: parent.locale ?? 'tr' }
    for (const segment of segments) if (segment.startsWith('[')) row[segment.slice(1, -1)] = DYNAMIC_PROBE
    return [row]
  }
  const params: Record<string, string>[] = []
  for (const locale of ['tr', 'en'] as const) {
    if (parent.locale && parent.locale !== locale) continue
    for (const entry of await entries()) {
      const parts = entry.paths[locale]?.split('/')
      if (!parts || parts.length !== segments.length) continue
      const row: Record<string, string> = { locale }
      if (segments.every((segment, i) => {
        if (!segment.startsWith('[')) return segment === parts[i]
        row[segment.slice(1, -1)] = decodeURIComponent(parts[i])
        return true
      }) && Object.entries(parent).every(([key, value]) => !row[key] || row[key] === value)) params.push(row)
    }
  }
  return params
}
