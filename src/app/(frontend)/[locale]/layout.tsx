import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

const GeistMono = localFont({ src: '../../../../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2', variable: '--font-geist-mono', preload: false, display: 'swap' })
import { GeistSans } from 'geist/font/sans'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
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
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
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
        </NextIntlClientProvider>
        {/* F8: only in draft mode with a re-validated staff session; never part of a cached render. */}
        {previewUser && <LivePreviewRefresh label={t('exitPreview')} />}
        {!previewUser && process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <CloudflareAnalytics token={process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN} />
        )}
      </body>
    </html>
  )
}
