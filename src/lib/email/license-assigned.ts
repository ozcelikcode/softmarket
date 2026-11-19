import type { License } from '@/payload-types'
import type { CollectionAfterChangeHook, Payload } from 'payload'
import { after } from 'next/server'
import { SMTP_UNAVAILABLE, isEmailConfigured, type SmtpOnlyEmail } from './adapter'
import { emailLocale, emailTemplate, type EmailLocale } from './template'

const idOf = (value: number | { id: number }) => typeof value === 'object' ? value.id : value

/**
 * Context flag set by payment fulfilment (src/lib/payments/store/fulfillment.ts). Licences issued for an order are
 * e-mailed by the order notification queue (src/lib/payments/notify.ts, durable "sent" marker, works in the
 * reconcile CLI where `after()` is unavailable). The hook skips them so a licence is never e-mailed twice.
 */
export const ORDER_FULFILMENT_CONTEXT = 'paymentsOrderFulfilment'

type LicenseLike = Pick<License, 'key' | 'edition' | 'expiresAt'>

/** Subject, text and HTML for one or more licences (rows per licence, same layout as before). */
export async function buildLicenseEmail(payload: Payload, licenses: LicenseLike[], locale: EmailLocale) {
  const en = locale === 'en'
  const subject = en ? 'Your SoftMarket license has been assigned' : 'SoftMarket lisansınız atandı'
  const rows: [string, string][] = []
  for (const license of licenses) {
    const edition = await payload.findByID({ collection: 'editions', id: idOf(license.edition), locale, depth: 0, overrideAccess: true })
    const product = await payload.findByID({ collection: 'products', id: idOf(edition.product), locale, depth: 0, overrideAccess: true })
    rows.push(
      [en ? 'License key' : 'Lisans anahtarı', license.key],
      [en ? 'Product' : 'Ürün', product.title],
      [en ? 'Edition' : 'Sürüm', `${edition.title} (${edition.sku})`],
      [en ? 'Expires' : 'Bitiş', license.expiresAt ? new Intl.DateTimeFormat(en ? 'en-GB' : 'tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(new Date(license.expiresAt)) : en ? 'Perpetual' : 'Süresiz'],
    )
  }
  return {
    subject,
    text: `${subject}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}`,
    html: emailTemplate({ locale, title: subject, rows }),
  }
}

/**
 * Manually assigned licences (admin panel / MCP / REST): best effort after the response; neither lookup nor SMTP
 * errors may undo assignment. Order licences are skipped here (see ORDER_FULFILMENT_CONTEXT).
 */
export const notifyLicenseAssigned: CollectionAfterChangeHook<License> = async ({ doc, operation, req, context }) => {
  if (operation !== 'create') return doc
  if (context?.[ORDER_FULFILMENT_CONTEXT] === true) return doc
  // Never hand the key to an unconfigured mailer. Env SMTP (complete) is checked here; without env SMTP the
  // admin-panel SMTP (integrations) is checked after the response, outside the assignment transaction.
  const smtpHost = process.env.SMTP_HOST?.trim()
  const envSmtp = Boolean(smtpHost && !smtpHost.startsWith('CHANGE_'))
  if (envSmtp && !process.env.SMTP_FROM) {
    req.payload.logger.error('License assignment email skipped: SMTP is not configured.')
    return doc
  }
  try {
    after(async () => {
      try {
        if (!envSmtp && !(await isEmailConfigured(req.payload))) {
          req.payload.logger.error('License assignment email skipped: SMTP is not configured.')
          return
        }
        // A collection afterChange hook runs before commit. An independent read after
        // the response also rejects rolled-back assignments and reused numeric IDs.
        const committed = await req.payload.findByID({ collection: 'licenses', id: doc.id, depth: 0, overrideAccess: true })
        if (committed.key !== doc.key) return
        const customer = await req.payload.findByID({ collection: 'customers', id: idOf(doc.customer), depth: 0, overrideAccess: true })
        const message: SmtpOnlyEmail = { to: customer.email, requireSmtp: true, ...await buildLicenseEmail(req.payload, [doc], emailLocale(customer)) }
        if (await req.payload.sendEmail(message) === SMTP_UNAVAILABLE) {
          req.payload.logger.error('License assignment email skipped: SMTP is not configured.')
        }
      } catch {
        req.payload.logger.error('License assignment email failed; license retained.')
      }
    })
  } catch {
    req.payload.logger.error('License assignment email could not be scheduled outside a request.')
  }
  return doc
}
