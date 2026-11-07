import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { formMessages } from '@/components/portal/messages'
import { PortalForm } from '@/components/portal/portal-form'
import { TicketBadge } from '@/components/portal/status-badge'
import { SetAlternates } from '@/components/layout/set-alternates'
import { AppLink } from '@/components/ui/app-link'
import { Heading } from '@/components/ui/heading'
import { alternateHrefs, initLocale } from '@/lib/page-utils'
import { replyTicketAction } from '@/lib/portal/actions'
import { getMyTicket } from '@/lib/portal/data'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils'

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const { id } = await params
  const t = await getTranslations({ locale, namespace: 'portal.tickets' })
  // No ticket data in metadata: the page is private and the title stays generic.
  return buildMetadata({ locale, path: `/hesap/talepler/${encodeURIComponent(id)}`, title: t('title'), noindex: true })
}

const dateTime = (value: string, locale: string) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default async function TicketPage({ params }: Props) {
  const locale = await initLocale(params)
  const { id } = await params
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound()
  const customer = await requireCustomer(locale)
  // Someone else's ticket is indistinguishable from a missing one.
  const found = await getMyTicket(customer, locale, Number(id))
  if (!found) notFound()
  const { ticket, messages } = found
  const [t, p, f] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.tickets' }),
    getTranslations({ locale, namespace: 'portal' }),
    getTranslations({ locale, namespace: 'portal.form' }),
  ])
  const path = `/hesap/talepler/${ticket.id}`
  return (
    <div className="max-w-3xl">
      <SetAlternates hrefs={alternateHrefs({ tr: path, en: path })} />
      <AppLink href="/hesap/talepler" locale={locale} className="inline-flex items-center gap-1.5 text-small text-muted hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        {t('back')}
      </AppLink>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <Heading as="h1" size="h2" className="min-w-0 break-words">
          {ticket.subject}
        </Heading>
        <TicketBadge status={ticket.status} label={t(ticket.status)} />
      </div>
      {ticket.product ? <p className="mt-2 text-muted">{ticket.product}</p> : null}

      <section aria-labelledby="history" className="mt-8">
        <h2 id="history" className="sr-only">
          {t('history')}
        </h2>
        <ol className="space-y-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                'rounded-lg border p-5',
                m.author === 'customer' ? 'border-border bg-surface' : 'border-accent/30 bg-accent/5',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-small">
                <span className="font-medium">{m.author === 'customer' ? t('you') : t('staff')}</span>
                <time dateTime={m.createdAt} className="text-muted">
                  {dateTime(m.createdAt, locale)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8">
        {ticket.status === 'closed' ? (
          <p role="note" className="rounded-lg border border-border bg-surface-2 p-5 text-muted">
            {t('closedNote')}
          </p>
        ) : (
          <div className="rounded-lg border border-border bg-surface p-6">
            <Heading as="h2" size="h4" className="mb-4">
              {t('replyTitle')}
            </Heading>
            <PortalForm
              action={replyTicketAction}
              id="reply"
              locale={locale}
              hidden={{ ticket: String(ticket.id) }}
              fields={[{ name: 'body', label: p('fields.reply'), type: 'textarea', required: true, minLength: 2, maxLength: 10000, rows: 5 }]}
              submitLabel={t('send')}
              sendingLabel={f('sending')}
              fieldError={f('fieldError')}
              messages={formMessages(f)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
