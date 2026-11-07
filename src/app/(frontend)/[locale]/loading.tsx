'use client'

import { useTranslations } from 'next-intl'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'

export default function Loading() {
  const t = useTranslations('feedback')
  return <Section theme="dark" className="min-h-[60vh] pb-24 pt-44">
    <Container size="narrow"><p role="status" aria-live="polite" className="text-center text-lead text-muted">{t('loading')}</p></Container>
  </Section>
}
