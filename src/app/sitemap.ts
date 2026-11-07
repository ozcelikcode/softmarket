import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'

import { getSitemapEntries } from '@/lib/content'
import { getSupportSitemapEntries } from '@/lib/support'
import { routing } from '@/i18n/routing'
import { absoluteUrl } from '@/lib/seo'

// Rendered per request: Next 15.4's file-system ISR cache never applies revalidated tags to route handlers
// (APP_ROUTE entries skip the tag staleness check), so `revalidatePath` on publish could not refresh a cached
// sitemap and new landing pages would stay missing for up to the revalidate window (F6).
export const dynamic = 'force-dynamic'
const generatedAt = new Date().toISOString()

/** Static, listing and CMS URLs for both locales, with hreflang alternates between them. */
const STATIC = [
  '/',
  '/urunler',
  '/cozumler',
  '/sirket/hakkimizda',
  '/referanslar',
  '/haberler',
  '/kariyer',
  '/is-ortaklari',
  '/iletisim',
  '/destek',
  '/destek/indirmeler',
  '/destek/dokumantasyon',
  '/destek/surum-notlari',
  '/destek/sss',
  '/destek/talep',
  '/demo-talep',
  '/teklif-iste',
]

const cachedEntries = unstable_cache(
  async () => (await Promise.all([getSitemapEntries(), getSupportSitemapEntries()])).flat(),
  ['public-sitemap-entries'],
  { tags: ['public-sitemap'], revalidate: 3600 },
)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cms = await cachedEntries()
  const entries: MetadataRoute.Sitemap = []
  const push = (
    paths: Partial<Record<(typeof routing.locales)[number], string>>,
    lastModified?: string,
  ) => {
    const languages: Record<string, string> = {}
    for (const l of routing.locales) if (paths[l]) languages[l] = absoluteUrl(paths[l]!, l)
    if (languages.tr) languages['x-default'] = languages.tr
    for (const l of routing.locales) {
      if (!paths[l]) continue
      entries.push({
        url: languages[l],
        lastModified: new Date(lastModified || generatedAt),
        alternates: { languages },
      })
    }
  }
  for (const p of STATIC) push(Object.fromEntries(routing.locales.map((l) => [l, p])))
  for (const e of cms) push(e.paths, e.lastModified)
  return entries
}
