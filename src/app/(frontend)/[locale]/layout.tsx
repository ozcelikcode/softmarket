import type { Metadata, Viewport } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { CloudflareAnalytics } from '@/components/analytics/cloudflare'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { routing } from '@/i18n/routing'
import { AlternatesProvider } from '@/lib/alternates-store'
import { siteUrl } from '@/lib/seo'

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
  const t = await getTranslations({ locale, namespace: 'common' })
  return {
    title: { default: `${t('siteName')} | ${t('tagline')}`, template: `%s | ${t('siteName')}` },
    description: t('tagline'),
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
  const t = await getTranslations({ locale, namespace: 'common' })

  return (
    <html
      lang={locale}
      data-theme="dark"
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
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <CloudflareAnalytics token={process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN} />
        )}
      </body>
    </html>
  )
}
