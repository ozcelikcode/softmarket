import { cache } from 'react'
import { getSitemapEntries } from './content'
import { getSupportSitemapEntries } from './support'
const entries = cache(async () => (await Promise.all([getSitemapEntries(), getSupportSitemapEntries()])).flat())

export async function contentStaticParams(template: string, parent: Record<string, string> = {}) {
  const segments = template.split('/')
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
