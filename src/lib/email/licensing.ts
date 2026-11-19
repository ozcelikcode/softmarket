import type { Payload } from 'payload'

import { displayDeviceLabel } from '@/lib/licensing/device-metadata'
import { SMTP_UNAVAILABLE, type SmtpOnlyEmail } from './adapter'
import { alertRecipient } from './order-review'
import { emailTemplate, type EmailLocale } from './template'

/*
 * L5 licensing e-mails. Called ONLY by the durable licensing notification queue (src/lib/licensing/rules/notify.ts),
 * which checks SMTP first and records a "sent" marker per message, so each message goes out at least once.
 *
 * Admin alerts and the daily digest carry no personal data (plan §7): event type, severity, count, outcome, the
 * license public ID shortened to its last 6 characters and a panel link. No IP, e-mail, key or fingerprint.
 * Recipients: licensing-settings `notifications.alertEmails`, else PAYMENTS_ALERT_EMAIL, else site-settings
 * `contact.email`.
 *
 * Customer e-mails (TR + EN by the customer's preferred locale): the license was suspended automatically / re-enabled.
 * The only personal data is the recipient address of the outgoing message itself.
 */

export type AlertRow = {
  id: number
  type: string
  severity: string
  count: number
  outcome: string | null
  license: string | null
  rule: string | null
}

export type DigestSummary = {
  since: string
  bySeverity: Record<string, number>
  openHigh: number
  ruleSuspensions: number
  circuitOpen: boolean
}

export const shortId = (publicId: string | null | undefined) => (publicId ? `…${publicId.slice(-6)}` : '-')

const SAFE = /^[A-Za-z0-9_.:-]{1,64}$/
const safe = (value: string | null | undefined) => (value && SAFE.test(value) ? value : '-')

export async function adminAlertRecipients(payload: Payload, configured: string[], env: Record<string, string | undefined> = process.env): Promise<string[]> {
  if (configured.length) return configured
  const fallback = alertRecipient(env)
  if (fallback) return [fallback]
  try {
    const site = (await payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })) as { contact?: { email?: string | null } | null }
    const email = site.contact?.email?.trim()
    return email && !email.startsWith('CHANGE_') && /^[^\s@]+@[^\s@]+$/.test(email) ? [email] : []
  } catch {
    return []
  }
}

export async function sendLicensingAdminAlert(
  payload: Payload, to: string[], rows: AlertRow[], ctx: { origin: string },
): Promise<'sent' | 'not_configured'> {
  if (!to.length) return 'not_configured'
  const critical = rows.some((r) => r.severity === 'critical')
  const subject = `${critical ? '[KRİTİK/CRITICAL] ' : ''}Lisans güvenlik uyarısı / Licensing security alert (${rows.length})`
  const body = 'Güvenlik merkezinde inceleyin. Otomatik askılar panelden geri alınabilir. / Review in the security center. Automatic suspensions can be reversed in the panel.'
  const lines = rows.map((r) => [
    `#${r.id} ${safe(r.type)}`,
    `${safe(r.severity)} ×${Number.isFinite(r.count) ? r.count : 1}${r.outcome ? ` · ${safe(r.outcome)}` : ''}${r.rule ? ` · ${safe(r.rule)}` : ''} · lic ${shortId(r.license && /^[0-9a-f]{24}$/.test(r.license) ? r.license : null)}`,
  ] as const)
  const url = `${ctx.origin}/admin/guvenlik`
  const message: SmtpOnlyEmail = {
    to, requireSmtp: true,
    subject,
    text: `${subject}\n\n${body}\n\n${lines.map(([a, b]) => `${a}: ${b}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale: 'tr', title: subject, body, rows: lines, action: { label: 'Güvenlik merkezi / Security center', url } }),
  }
  return (await payload.sendEmail(message)) === SMTP_UNAVAILABLE ? 'not_configured' : 'sent'
}

export async function sendLicensingDigest(
  payload: Payload, to: string[], summary: DigestSummary, ctx: { origin: string },
): Promise<'sent' | 'not_configured'> {
  if (!to.length) return 'not_configured'
  const subject = 'Lisans güvenliği günlük özet / Licensing security daily digest'
  const body = `Son 24 saat / Last 24 hours (since ${summary.since}).`
  const rows: [string, string][] = [
    ...Object.entries(summary.bySeverity).map(([severity, n]) => [`Olay / Events: ${safe(severity)}`, String(n)] as [string, string]),
    ['Açık yüksek+ / Open high+', String(summary.openHigh)],
    ['Otomatik askı / Automatic suspensions', String(summary.ruleSuspensions)],
    ['Devre kesici / Circuit breaker', summary.circuitOpen ? 'AÇIK / OPEN' : 'kapalı / closed'],
  ]
  const url = `${ctx.origin}/admin/guvenlik`
  const message: SmtpOnlyEmail = {
    to, requireSmtp: true,
    subject,
    text: `${subject}\n\n${body}\n\n${rows.map(([a, b]) => `${a}: ${b}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale: 'tr', title: subject, body, rows, action: { label: 'Güvenlik merkezi / Security center', url } }),
  }
  return (await payload.sendEmail(message)) === SMTP_UNAVAILABLE ? 'not_configured' : 'sent'
}

export type CustomerNotice = {
  kind: 'suspended' | 'restored'
  to: string
  locale: EmailLocale
  product: string
  maskedKey: string
}

const COPY = {
  suspended: {
    tr: {
      subject: 'Lisansınız geçici olarak askıya alındı',
      body: 'Lisansınızda olağan dışı kullanım tespit edildiği için lisans otomatik olarak geçici olarak askıya alındı. Mevcut cihazlarınız çevrimdışı kira süresi dolana kadar çalışmaya devam eder; yeni etkinleştirme ve yenileme yapılamaz. Bunun bir hata olduğunu düşünüyorsanız destek talebi oluşturun; inceleme sonrasında lisansınız yeniden etkinleştirilir.',
      action: 'Lisanslarım',
    },
    en: {
      subject: 'Your license has been suspended temporarily',
      body: 'Unusual activity was detected on your license, so it was suspended automatically for now. Your existing devices keep working until their offline lease ends; new activations and renewals are not possible. If you think this is a mistake, open a support ticket; the license is re-enabled after review.',
      action: 'My licenses',
    },
  },
  restored: {
    tr: {
      subject: 'Lisansınız yeniden etkinleştirildi',
      body: 'İnceleme tamamlandı ve lisansınız yeniden etkinleştirildi. Yaşanan aksaklık için özür dileriz. Uygulamanız bir sonraki bağlantıda lisansı otomatik olarak yeniler.',
      action: 'Lisanslarım',
    },
    en: {
      subject: 'Your license has been re-enabled',
      body: 'The review is complete and your license has been re-enabled. We apologise for the inconvenience. Your application renews the license automatically the next time it connects.',
      action: 'My licenses',
    },
  },
} as const

export const licensesPath = (locale: EmailLocale) => (locale === 'en' ? '/en/account/licenses' : '/tr/hesap/lisanslar')

export function buildCustomerNotice(notice: CustomerNotice, origin: string) {
  const en = notice.locale === 'en'
  const copy = COPY[notice.kind][notice.locale]
  const rows: [string, string][] = [
    [en ? 'Product' : 'Ürün', notice.product],
    [en ? 'License' : 'Lisans', notice.maskedKey],
  ]
  const url = `${origin}${licensesPath(notice.locale)}`
  return {
    to: notice.to,
    subject: copy.subject,
    text: `${copy.subject}\n\n${copy.body}\n\n${rows.map(([a, b]) => `${a}: ${b}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale: notice.locale, title: copy.subject, body: copy.body, rows, action: { label: copy.action, url } }),
  }
}

export async function sendCustomerLicenseNotice(payload: Payload, notice: CustomerNotice, ctx: { origin: string }): Promise<'sent' | 'not_configured'> {
  const message: SmtpOnlyEmail = { ...buildCustomerNotice(notice, ctx.origin), requireSmtp: true }
  return (await payload.sendEmail(message)) === SMTP_UNAVAILABLE ? 'not_configured' : 'sent'
}

export type DeviceReleasedNotice = {
  to: string
  locale: EmailLocale
  product: string
  maskedKey: string
  /** Untrusted (set by the licensed program); escaped by the template and bounded here. */
  deviceLabel: string | null
}

const RELEASED = {
  tr: {
    subject: 'Lisansınızdan bir cihaz kaldırıldı',
    body: 'Hesabınızdan lisansınızın bir cihazı kaldırıldı ve koltuğu boşaldı. Bu işlemi siz yapmadıysanız hemen parolanızı değiştirin ve destek talebi oluşturun.',
    action: 'Lisanslarım',
    labels: ['Ürün', 'Lisans', 'Cihaz'],
  },
  en: {
    subject: 'A device was removed from your license',
    body: 'A device was released from your license from your account and its seat is free again. If you did not do this, change your password right away and open a support ticket.',
    action: 'My licenses',
    labels: ['Product', 'License', 'Device'],
  },
} as const

export function buildDeviceReleasedNotice(notice: DeviceReleasedNotice, origin: string) {
  const copy = RELEASED[notice.locale]
  const deviceLabel = displayDeviceLabel(notice.deviceLabel)
  const rows: [string, string][] = [
    [copy.labels[0], notice.product],
    [copy.labels[1], notice.maskedKey],
    ...(deviceLabel ? [[copy.labels[2], deviceLabel] as [string, string]] : []),
  ]
  const url = `${origin}${licensesPath(notice.locale)}`
  return {
    to: notice.to,
    subject: copy.subject,
    text: `${copy.subject}\n\n${copy.body}\n\n${rows.map(([a, b]) => `${a}: ${b}`).join('\n')}\n\n${url}`,
    html: emailTemplate({ locale: notice.locale, title: copy.subject, body: copy.body, rows, action: { label: copy.action, url } }),
  }
}

export async function sendDeviceReleasedNotice(payload: Payload, notice: DeviceReleasedNotice, ctx: { origin: string }): Promise<'sent' | 'not_configured'> {
  const message: SmtpOnlyEmail = { ...buildDeviceReleasedNotice(notice, ctx.origin), requireSmtp: true }
  return (await payload.sendEmail(message)) === SMTP_UNAVAILABLE ? 'not_configured' : 'sent'
}
