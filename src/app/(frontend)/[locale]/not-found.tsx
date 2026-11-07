import { getLocale, getTranslations } from 'next-intl/server'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { localizedHref } from '@/i18n/paths'

const POPULAR = [
  ['products', '/urunler'],
  ['solutions', '/cozumler'],
  ['documentation', '/destek/dokumantasyon'],
  ['downloads', '/destek/indirmeler'],
  ['contact', '/iletisim'],
] as const

export default async function NotFound() {
  const locale = await getLocale()
  const [t, n] = await Promise.all([
    getTranslations({ locale, namespace: 'notFound' }),
    getTranslations({ locale, namespace: 'nav' }),
  ])
  return (
    <Section theme="dark" spacing="none" className="overflow-hidden pb-24 pt-44">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <Container size="narrow" className="relative text-center">
        <Eyebrow className="mb-4">404</Eyebrow>
        <Heading as="h1" size="h1">{t('title')}</Heading>
        <p className="mx-auto mt-5 max-w-md text-lead text-muted">{t('lead')}</p>
        <form role="search" method="get" action={localizedHref('/ara', locale)} className="mx-auto mt-9 flex max-w-md gap-3">
          <label htmlFor="notfound-q" className="sr-only">{t('searchLabel')}</label>
          <input
            id="notfound-q"
            name="q"
            type="search"
            minLength={2}
            maxLength={120}
            required
            placeholder={t('searchPlaceholder')}
            className="h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-text placeholder:text-muted"
          />
          <Button type="submit">{t('search')}</Button>
        </form>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><AppLink href="/" locale={locale}>{t('home')}</AppLink></Button>
          <Button asChild size="lg" variant="secondary"><AppLink href="/urunler" locale={locale}>{t('products')}</AppLink></Button>
        </div>
        <nav aria-label={t('popular')} className="mt-12">
          <p className="text-eyebrow font-semibold uppercase text-muted">{t('popular')}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-x-6">
            {POPULAR.map(([key, href]) => (
              <li key={href}>
                <AppLink href={href} locale={locale} className="inline-flex min-h-11 items-center text-small text-text/90 underline-offset-4 hover:text-accent hover:underline">
                  {n(key)}
                </AppLink>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </Section>
  )
}
