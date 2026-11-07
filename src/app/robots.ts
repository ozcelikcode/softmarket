import type { MetadataRoute } from 'next'

import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/tr/hesap', '/en/account', '/tr/ara', '/en/search', '/tr/arama'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
