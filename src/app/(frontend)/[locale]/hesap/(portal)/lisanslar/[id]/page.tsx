import { randomBytes } from 'node:crypto'

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { PortalHeading } from '@/components/portal/portal-heading'
import { LicenseBadge } from '@/components/portal/status-badge'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import { listPortalDevices } from '@/lib/licensing/portal-devices'
import { initLocale } from '@/lib/page-utils'
import { getMyLicenseByPublicId } from '@/lib/portal/data'
import { releaseDeviceAction } from '@/lib/portal/device-actions'
import { DEVICE_NOTICES, type DeviceNotice } from '@/lib/portal/device-notices'
import { requireCustomer } from '@/lib/portal/require'
import { buildMetadata } from '@/lib/seo'
import { getPayloadClient } from '@/lib/site'

type Props = {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ cihaz?: string | string[]; kaldir?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'portal.devices' })
  return buildMetadata({ locale, path: '/hesap/lisanslar', title: t('title'), noindex: true })
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const PLATFORMS = ['windows', 'macos', 'linux', 'other'] as const

export default async function LicenseDevicesPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const { id } = await params
  const customer = await requireCustomer(locale)
  const license = await getMyLicenseByPublicId(customer, locale, id)
  // Foreign, unknown and malformed ids are indistinguishable.
  if (!license) notFound()

  const sp = await searchParams
  const noticeParam = first(sp.cihaz)
  const notice = (DEVICE_NOTICES as readonly string[]).includes(noticeParam ?? '') ? (noticeParam as DeviceNotice) : null
  const [t, ls, payload] = await Promise.all([
    getTranslations({ locale, namespace: 'portal.devices' }),
    getTranslations({ locale, namespace: 'portal.licenseState' }),
    getPayloadClient(),
  ])
  const summary = await listPortalDevices(payload, { licenseId: license.id, customerId: Number(customer.id) })
  if (!summary) notFound()
  const blocked = license.state === 'revoked' ? 'revoked' : summary.releaseLimit <= 0 ? 'disabled' : summary.releasesLeft <= 0 ? 'limit' : null
  const releasable = blocked === null
  const confirming = summary.devices.find((d) => d.id === first(sp.kaldir)) ?? null
  const token = randomBytes(16).toString('hex')
  const deviceName = (d: { label: string | null }, i: number) => d.label?.trim() || t('unnamed', { n: summary.devices.length - i })

  return (
    <>
      <PortalHeading
        title={`${license.product}${license.edition ? ` · ${license.edition}` : ''}`}
        lead={t('lead')}
        actions={
          <Button asChild variant="secondary" size="sm">
            <AppLink href="/hesap/lisanslar" locale={locale}>
              {t('back')}
            </AppLink>
          </Button>
        }
      />

      {notice ? (
        <p role="status" className={`mb-6 rounded-md border px-4 py-3 text-small ${notice === 'released' ? 'border-success text-success' : 'border-danger text-danger'}`}>
          {t(`notice.${notice}`)}
        </p>
      ) : null}

      <Card className="mb-6">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-small text-muted">{t('status')}</dt>
            <dd className="mt-1">
              <LicenseBadge state={license.state} label={ls(license.state)} />
            </dd>
          </div>
          <div>
            <dt className="text-small text-muted">{t('ends')}</dt>
            <dd className="mt-1">{license.expiresAt ? formatDate(license.expiresAt, locale) : t('perpetual')}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">{t('seatsUsed')}</dt>
            <dd className="mt-1 tabular-nums">{summary.max ? t('seatsOf', { used: summary.used, max: summary.max }) : summary.used}</dd>
          </div>
          <div>
            <dt className="text-small text-muted">{t('key')}</dt>
            <dd className="mt-1 break-all font-mono text-small">{license.maskedKey}</dd>
          </div>
        </dl>
        {license.state === 'suspended' || license.state === 'revoked' || license.state === 'expired' ? (
          <div className="mt-5 border-t border-border pt-4 text-small text-muted">
            <p>{t(`stateNote.${license.state}`)}</p>
            {license.state !== 'expired' ? (
              <p className="mt-2">
                <AppLink href="/hesap/talepler/yeni" locale={locale} className="text-accent underline-offset-4 hover:underline">
                  {t('support')}
                </AppLink>
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <h2 className="mb-3 text-h4 font-semibold">{t('devices')}</h2>
      <p className="mb-4 text-small text-muted">
        {summary.releaseLimit > 0 ? t('quota', { left: summary.releasesLeft, limit: summary.releaseLimit }) : t('quotaOff')}
      </p>

      {confirming ? (
        <Card className="mb-6 border-warning" role="group" aria-labelledby="release-title">
          <h3 id="release-title" className="font-semibold">
            {t('confirmTitle', { name: deviceName(confirming, summary.devices.indexOf(confirming)) })}
          </h3>
          <p className="mt-2 text-small text-muted">{t('confirmText')}</p>
          {releasable ? (
            <form action={releaseDeviceAction} className="mt-4 flex flex-wrap gap-3">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="license" value={license.publicId} />
              <input type="hidden" name="device" value={confirming.id} />
              <input type="hidden" name="token" value={token} />
              <Button type="submit">{t('confirm')}</Button>
              <Button asChild variant="secondary">
                <AppLink href={`/hesap/lisanslar/${license.publicId}`} locale={locale}>
                  {t('cancel')}
                </AppLink>
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-small text-danger">{t(`notice.${blocked}`)}</p>
          )}
        </Card>
      ) : null}

      {summary.devices.length ? (
        <ul className="space-y-3">
          {summary.devices.map((d, i) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium break-words">{deviceName(d, i)}</p>
                <p className="text-small text-muted">
                  {[
                    d.platform && (PLATFORMS as readonly string[]).includes(d.platform) ? t(`platform.${d.platform as (typeof PLATFORMS)[number]}`) : null,
                    `${t('activated')}: ${formatDate(d.activatedAt, locale)}`,
                    d.lastSeenAt ? `${t('lastSeen')}: ${formatDate(d.lastSeenAt, locale)}` : null,
                    d.country ? `${t('country')}: ${d.country}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              {releasable ? (
                <Button asChild variant="secondary" size="sm">
                  <AppLink href={`/hesap/lisanslar/${license.publicId}?kaldir=${d.id}`} locale={locale}>
                    {t('release')}
                  </AppLink>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-muted">{t('none')}</p>
      )}
      <p className="mt-4 text-small text-muted">{t('leaseNote')}</p>
    </>
  )
}
