// Fixtures for the payments e2e, written into the ISOLATED temp DB copy only (never the live database).
// Creates: a product with one buy edition (TRY + USD), clean (non-draft) sales legal pages in both locales and two
// verified customers. The site stays in quote mode: the spec flips it through the admin API.
import { realpathSync } from 'node:fs'

import { assertIsolatedE2E } from '../src/lib/e2e-isolation'

const { database } = assertIsolatedE2E()
const must = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}
const customers = [
  { email: must('E2E_CUSTOMER_EMAIL'), password: must('E2E_CUSTOMER_PASSWORD'), name: 'Ali Veli' },
  { email: must('E2E_CUSTOMER2_EMAIL'), password: must('E2E_CUSTOMER_PASSWORD'), name: 'Ayşe Kaya' },
]
const { getPayload } = await import('payload')
const config = (await import('../src/payload.config')).default
const payload = await getPayload({ config })
try {
  const dbs = await payload.db.drizzle.$client.execute('PRAGMA database_list')
  const main = dbs.rows.find((row) => row.name === 'main')?.file
  if (!main || realpathSync(String(main)) !== database) throw new Error('Payload did not open the isolated E2E database; refusing to seed.')

  const family = await payload.create({ collection: 'product-families', overrideAccess: true, locale: 'tr', data: { title: 'E2E Aile', slug: 'e2e-aile', _status: 'published' } as never })
  const product = await payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'E2E Ürün', slug: 'e2e-urun', family: family.id, _status: 'published' } as never })
  await payload.create({
    collection: 'editions', overrideAccess: true, locale: 'tr',
    data: { title: 'E2E Pro', sku: 'E2E-PAY-1', product: product.id, licenseType: 'subscription', durationMonths: 12, seats: 3, saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 125000, usdMinor: 4000 } } as never,
  })

  const paragraph = (text: string) => ({ type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] })
  const content = (text: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [paragraph(text), paragraph('Second paragraph of the reviewed e2e text.')] } })
  // A kind may be held by one page only: release the pages of the copied database first.
  const marked = await payload.find({ collection: 'pages', overrideAccess: true, depth: 0, limit: 50, pagination: false, where: { commerceLegal: { exists: true } }, select: { commerceLegal: true } })
  for (const page of marked.docs) await payload.update({ collection: 'pages', id: page.id, overrideAccess: true, data: { commerceLegal: null } as never, select: { slug: true } })
  for (const [kind, slug] of [['distanceSales', 'e2e-mesafeli-satis'], ['preInformation', 'e2e-on-bilgilendirme'], ['refund', 'e2e-iade-cayma']] as const) {
    const page = await payload.create({ collection: 'pages', overrideAccess: true, locale: 'tr', data: { title: `E2E ${kind}`, slug, pageType: 'legal', commerceLegal: kind, _status: 'published', legalReview: { approvedBy: 'E2E Counsel', approvedAt: '2026-11-01T00:00:00.000Z' }, layout: [{ blockType: 'richText', content: content(`Reviewed ${kind} text TR.`) }] } as never })
    // Same block ids, other locale (re-creating the array would drop the Turkish content).
    await payload.update({ collection: 'pages', id: page.id, overrideAccess: true, locale: 'en', data: { title: `E2E ${kind} EN`, slug: `${slug}-en`, _status: 'published', legalReview: { approvedBy: 'E2E Counsel', approvedAt: '2026-11-01T00:00:00.000Z' }, layout: (page.layout as { id: string }[]).map((block) => ({ ...block, content: content(`Reviewed ${kind} text EN.`) })) } as never })
  }
  // Selling needs complete company facts (seller identity) in both locales, and the lawyer approval above.
  for (const locale of ['tr', 'en'] as const) {
    await payload.updateGlobal({ slug: 'site-settings', overrideAccess: true, locale, data: {
      company: { legalName: 'E2E Yazılım A.Ş.', mersisNo: '0123456789012345', taxOffice: 'E2E VD', taxNumber: '1234567890', kepAddress: 'e2e@hs01.kep.tr', etbisNo: '123456' },
      contact: { address: 'E2E Cad. No 1, İstanbul', phone: '+90 212 000 00 00', email: 'e2e@example.com' },
    } as never })
  }
  for (const c of customers) {
    await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email: c.email, password: c.password, name: c.name, _verified: true, preferredLocale: 'tr' } as never })
  }
} finally {
  await payload.destroy()
}
