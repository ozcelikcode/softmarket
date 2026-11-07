import { getLocale, getTranslations } from 'next-intl/server'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'

export default async function NotFound() {
  const locale = await getLocale()
  const t = await getTranslations({ locale, namespace: 'notFound' })
  return (
    <Section theme="dark" spacing="none" className="overflow-hidden pb-24 pt-44">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <Container size="narrow" className="relative text-center">
        <Eyebrow className="mb-4">404</Eyebrow>
        <Heading as="h1" size="h1">{t('title')}</Heading>
        <p className="mx-auto mt-5 max-w-md text-lead text-muted">{t('lead')}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><AppLink href="/" locale={locale}>{t('home')}</AppLink></Button>
          <Button asChild size="lg" variant="secondary"><AppLink href="/urunler" locale={locale}>{t('products')}</AppLink></Button>
        </div>
      </Container>
    </Section>
  )
}
