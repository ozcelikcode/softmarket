'use client'

import { useLocale, useTranslations } from 'next-intl'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('feedback')
  const locale = useLocale()
  return <Section theme="dark" className="pb-24 pt-44">
    <Container size="narrow" className="text-center">
      <h1 className="text-h1">{t('title')}</h1>
      <p role="alert" className="mt-5 text-lead text-muted">{t('lead')}</p>
      <div className="mt-9 flex justify-center gap-3">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button asChild variant="secondary"><AppLink locale={locale} href="/">{t('home')}</AppLink></Button>
      </div>
    </Container>
  </Section>
}
