import type { License } from '@/payload-types'
import type { CollectionAfterChangeHook } from 'payload'
import { after } from 'next/server'
import { emailLocale, emailTemplate } from './template'

const idOf = (value: number | { id: number }) => typeof value === 'object' ? value.id : value

/** Delivery is best effort; neither lookup nor SMTP errors may undo assignment. */
export const notifyLicenseAssigned: CollectionAfterChangeHook<License> = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  // Payload's console adapter logs the entire message, including the license key.
  const smtpHost = process.env.SMTP_HOST?.trim()
  if (!smtpHost || smtpHost.startsWith('CHANGE_') || !process.env.SMTP_FROM) {
    req.payload.logger.error('License assignment email skipped: SMTP is not configured.')
    return doc
  }
  try {
    after(async () => {
      try {
        // A collection afterChange hook runs before commit. An independent read after
        // the response also rejects rolled-back assignments and reused numeric IDs.
        const committed = await req.payload.findByID({ collection: 'licenses', id: doc.id, depth: 0, overrideAccess: true })
        if (committed.key !== doc.key) return
        const customer = await req.payload.findByID({ collection: 'customers', id: idOf(doc.customer), depth: 0, overrideAccess: true })
        const locale = emailLocale(customer)
        const edition = await req.payload.findByID({ collection: 'editions', id: idOf(doc.edition), locale, depth: 0, overrideAccess: true })
        const product = await req.payload.findByID({ collection: 'products', id: idOf(edition.product), locale, depth: 0, overrideAccess: true })
        const en = locale === 'en'
        const subject = en ? 'Your SoftMarket license has been assigned' : 'SoftMarket lisansınız atandı'
        const rows: [string, string][] = [
          [en ? 'License key' : 'Lisans anahtarı', doc.key],
          [en ? 'Product' : 'Ürün', product.title],
          [en ? 'Edition' : 'Sürüm', `${edition.title} (${edition.sku})`],
          [en ? 'Expires' : 'Bitiş', doc.expiresAt ? new Intl.DateTimeFormat(en ? 'en-GB' : 'tr-TR', { dateStyle: 'long', timeZone: 'Europe/Istanbul' }).format(new Date(doc.expiresAt)) : en ? 'Perpetual' : 'Süresiz'],
        ]
        await req.payload.sendEmail({
          to: customer.email, subject,
          text: `${subject}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}`,
          html: emailTemplate({ locale, title: subject, rows }),
        })
      } catch {
        req.payload.logger.error('License assignment email failed; license retained.')
      }
    })
  } catch {
    req.payload.logger.error('License assignment email could not be scheduled outside a request.')
  }
  return doc
}
