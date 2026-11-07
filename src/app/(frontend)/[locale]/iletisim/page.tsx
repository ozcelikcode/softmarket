import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

import { EmptyState } from '@/components/sections/empty-state'
import { JsonLd } from '@/components/sections/json-ld'
import { PageHero } from '@/components/sections/page-hero'
import { Container } from '@/components/ui/container'
import { LeadFormSection } from '@/components/forms/lead-form-section'
import { Section } from '@/components/ui/section'
import { getContactSettings } from '@/lib/content'
import { initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'contact' })
  return buildMetadata({ locale, path: '/iletisim', title: t('title'), description: t('lead') })
}

const Row = ({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) => (
  <div className="flex gap-4 border-b border-border py-5 last:border-b-0">
    <span className="mt-0.5 text-accent [&_svg]:size-5">{icon}</span>
    <div className="min-w-0">
      <dt className="text-eyebrow font-semibold uppercase text-muted">{label}</dt>
      <dd className="mt-1.5 text-text [&_a]:text-accent [&_a:hover]:underline">{children}</dd>
    </div>
  </div>
)

async function ContactPage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'contact' }),
    getTranslations({ locale, namespace: 'common' }),
    getContactSettings(locale),
  ])
  const trail = [
    { label: c('home'), href: '/' },
    { label: t('title'), href: '/iletisim' },
  ]
  const ct = settings?.contact
  const mail = (addr?: string | null) =>
    addr && safeHref(`mailto:${addr}`) ? <a href={`mailto:${addr}`}>{addr}</a> : null
  const map = safeHref(ct?.mapUrl)
  const hasAny = Boolean(
    ct &&
    (ct.email || ct.salesEmail || ct.supportEmail || ct.phone || ct.address || ct.workingHours),
  )
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <PageHero
        locale={locale}
        crumbLabel={c('breadcrumb')}
        crumbs={trail}
        title={t('title')}
        lead={t('lead')}
      />
      <Section theme="light" spacing="md">
        <Container className="grid gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            {hasAny ? (
              <dl className="rounded-lg border border-border bg-surface px-6">
                {ct?.address ? (
                  <Row icon={<MapPin aria-hidden />} label={t('address')}>
                    <span className="whitespace-pre-line">{ct.address}</span>
                    {map && /^https?:/.test(map) ? (
                      <a
                        href={map}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-small"
                      >
                        {t('map')}
                      </a>
                    ) : null}
                  </Row>
                ) : null}
                {ct?.email && mail(ct.email) ? (
                  <Row icon={<Mail aria-hidden />} label={t('email')}>
                    {mail(ct.email)}
                  </Row>
                ) : null}
                {ct?.salesEmail && mail(ct.salesEmail) ? (
                  <Row icon={<Mail aria-hidden />} label={t('sales')}>
                    {mail(ct.salesEmail)}
                  </Row>
                ) : null}
                {ct?.supportEmail && mail(ct.supportEmail) ? (
                  <Row icon={<Mail aria-hidden />} label={t('support')}>
                    {mail(ct.supportEmail)}
                  </Row>
                ) : null}
                {ct?.phone && safeHref(`tel:${ct.phone.replace(/[^\d+]/g, '')}`) ? (
                  <Row icon={<Phone aria-hidden />} label={t('phone')}>
                    <a href={`tel:${ct.phone.replace(/[^\d+]/g, '')}`}>{ct.phone}</a>
                  </Row>
                ) : null}
                {ct?.workingHours ? (
                  <Row icon={<Clock aria-hidden />} label={t('hours')}>
                    {ct.workingHours}
                  </Row>
                ) : null}
              </dl>
            ) : (
              <EmptyState title={t('empty')} />
            )}
          </div>
          <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
            <LeadFormSection kind="contact" locale={locale} />
          </div>
        </Container>
      </Section>
    </>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><ContactPage {...props} /></DynamicSecurity>
}
