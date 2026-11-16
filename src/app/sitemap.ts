import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'

import { getCommerceState } from '@/lib/commerce/state'
import { getSitemapEntries } from '@/lib/content'
import { isCommerceLegalHref } from '@/lib/payments/legal'
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
  // Sales legal pages are listed only while payments are open (the cached entries stay mode-independent).
  const [cached, commerce] = await Promise.all([cachedEntries(), getCommerceState()])
  const cms = commerce.open ? cached : cached.map((e) => ({
    ...e,
    paths: Object.fromEntries(Object.entries(e.paths).filter(([, p]) => !isCommerceLegalHref(p))) as typeof e.paths,
  })).filter((e) => Object.keys(e.paths).length)
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
