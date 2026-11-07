import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { PortalHeading } from '@/components/portal/portal-heading'
import { EmptyState } from '@/components/sections/empty-state'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { initLocale } from '@/lib/page-utils'
import { createTicketAction } from '@/lib/portal/actions'
import { getMyLicenses, usableProducts } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.tickets' })
  return buildMetadata({ locale, path: '/hesap/talepler/yeni', title: t('newTitle'), noindex: true })
}

export default async function NewTicketPage({ params }: Props) {
  const locale = await initLocale(params)
  const customer = await requireCustomer(locale)
  const [t, p, f, licenses] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.tickets' }),
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
    getMyLicenses(customer, locale),
  ])
  const products = usableProducts(licenses)
  return (
    <>
      <PortalHeading title={t('newTitle')} lead={t('newLead')} />
      {products.length ? (
        <div className="max-w-2xl rounded-lg border border-border bg-surface p-6 sm:p-8">
          <PortalForm
            action={createTicketAction}
            id="ticket"
            locale={locale}
            fields={[
              {
                name: 'product',
                label: p('fields.product'),
                type: 'select',
                required: true,
                options: [{ value: '', label: p('fields.choose') }, ...products.map((x) => ({ value: String(x.id), label: x.title }))],
              },
              { name: 'subject', label: p('fields.subject'), required: true, minLength: 5, maxLength: 200 },
              { name: 'body', label: p('fields.message'), type: 'textarea', required: true, minLength: 10, maxLength: 10000, rows: 8 },
            ]}
            submitLabel={t('submit')}
            sendingLabel={f('sending')}
            fieldError={f('fieldError')}
            messages={formMessages(f)}
          />
        </div>
      ) : (
        <EmptyState
          title={t('noLicensed')}
          action={
            <Button asChild variant="secondary">
              <AppLink href="/hesap/talepler" locale={locale}>
                {t('back')}
              </AppLink>
            </Button>
          }
        />
      )}
    </>
  )
}
