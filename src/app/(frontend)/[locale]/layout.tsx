import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { hasLocale } from '@/i18n/has-locale'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'

import { CloudflareAnalytics } from '@/components/analytics/cloudflare'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { LivePreviewRefresh } from '@/components/preview/live-preview-refresh'
import { routing } from '@/i18n/routing'
import { AlternatesProvider } from '@/lib/alternates-store'
import { accentStyle } from '@/lib/brand'
import { getPreviewUser } from '@/lib/preview'
import { siteUrl } from '@/lib/seo'
import { getSiteSettings, siteIdentity } from '@/lib/site'

import '../globals.css'

// Subset Geist (scripts/subset-fonts.sh, variable wght, OFL). Only the primary file is preloaded:
// Latin + Latin-1 + Turkish (ĞğİıŞş) ≈ 28 KB. The rest of Latin Extended-A is a separate face with
// unicode-range, fetched only when a page contains those characters. Mono (≈ 20 KB) is never preloaded
// and only fetched where font-mono text renders. Literal options: next/font analyses them at build time.
// adjustFontFallback is off here; the shared "Geist Fallback" face (globals.css, Arial metrics with
// size-adjust) sits after both faces in --font-sans so the swap stays CLS-free.
const GeistSans = localFont({
  src: '../../../fonts/geist-sans-latin.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF,U+011E-011F,U+0130-0131,U+0152-0153,U+015E-015F,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+2000-206F,U+20AC,U+20BA,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD' }],
})
const GeistSansExt = localFont({
  src: '../../../fonts/geist-sans-latin-ext.woff2',
  variable: '--font-geist-sans-ext',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+0100-011D,U+0120-012F,U+0132-0151,U+0154-015D,U+0160-017F,U+0192,U+0218-021B,U+02C7,U+02D8-02D9,U+02DB,U+02DD,U+0300-0303,U+0306-0307,U+030A-030C,U+0326-0328,U+2113,U+2116,U+2194-2199,U+2219,U+221E,U+2248,U+2260,U+2264-2265,U+2713,U+2715' }],
})
const GeistMono = localFont({
  src: '../../../fonts/geist-mono-latin.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
})

export const revalidate = 3600

export const viewport: Viewport = { themeColor: '#0B0D10', colorScheme: 'dark light' }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) return {}
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: 'common' }), getSiteSettings(locale)])
  const site = siteIdentity(settings, t('siteName'))
  const tagline = site.tagline ?? t('tagline')
  // Icons live in public/ (not app/ file conventions, which would override a CMS favicon).
  const favicon = site.favicon
  return {
    title: { default: `${site.name} | ${tagline}`, template: `%s | ${site.name}` },
    description: tagline,
    applicationName: site.name,
    icons: favicon
      ? { icon: [{ url: favicon.url }], apple: [{ url: favicon.url }] }
      : {
          icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon.svg', type: 'image/svg+xml' }],
          apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
        },
    metadataBase: new URL(siteUrl()),
    openGraph: { images: [`/${locale}/opengraph-image`] },
    twitter: { card: 'summary_large_image', images: [`/${locale}/opengraph-image`] },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const [t, settings, previewUser] = await Promise.all([
    getTranslations({ locale, namespace: 'common' }), getSiteSettings(locale), getPreviewUser(),
  ])
  const site = siteIdentity(settings, t('siteName'))

  return (
    <html
      lang={locale}
      data-theme="dark"
      // SiteSettings.motion=none: globals.css + MotionObserver keep everything static.
      data-motion={site.motion === 'none' ? 'none' : undefined}
      // SiteSettings.brand.accent: validated/derived tones as CSS variables (inline style attribute, CSP style-src allows it).
      style={accentStyle(site.accent) as CSSProperties}
      className={`${GeistSans.variable} ${GeistSansExt.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans antialiased">
        {/* No NextIntlClientProvider: client components get strings as props (or static JSON picks), so the
            ICU message parser and the message catalogue never ship to the browser. Add a provider with a
            `messages` pick only if a client component must call useTranslations. */}
        <AlternatesProvider>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-accent px-4 py-2 text-small font-medium text-accent-contrast focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
            >
              {t('skipToContent')}
            </a>
            <Header locale={locale} />
            <main id="main" tabIndex={-1} className="-mt-16 lg:-mt-[4.5rem]">
              {children}
            </main>
            <Footer locale={locale} />
        </AlternatesProvider>
        {/* F8: only in draft mode with a re-validated staff session; never part of a cached render. */}
        {previewUser && <LivePreviewRefresh label={t('exitPreview')} />}
        {!previewUser && process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <CloudflareAnalytics token={process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN} />
        )}
      </body>
    </html>
  )
}
