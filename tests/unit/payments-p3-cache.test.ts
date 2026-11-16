import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const next = vi.hoisted(() => ({ unstable_noStore: vi.fn() }))
const db = vi.hoisted(() => ({ findGlobal: vi.fn(), find: vi.fn() }))
vi.mock('next/cache', () => next)
vi.mock('@/lib/site', () => ({
  getPayloadClient: async () => db,
  safe: async (fn: () => Promise<unknown>, fallback: unknown) => { try { return await fn() } catch { return fallback } },
}))
import { getCommerceState } from '@/lib/commerce/state'
import { getProductDetail } from '@/lib/content'

const saved = { ...process.env }
const LEGAL = ['distanceSales', 'preInformation', 'refund'].map((commerceLegal) => ({ commerceLegal, title: 'Legal', slug: commerceLegal, layout: [{ blockType: 'richText', content: { root: { children: [{ type: 'text', text: 'Reviewed legal text' }] } } }] }))
const site = { commerce: { mode: 'payments', providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'exempt' } } } }
beforeEach(() => {
  Object.assign(process.env, { PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'k', IYZICO_SECRET_KEY: 's', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' })
  vi.resetAllMocks()
  db.findGlobal.mockResolvedValue(site)
  db.find.mockResolvedValue({ docs: LEGAL })
})
afterEach(() => { process.env = { ...saved } })

it('open surfaces opt out of shared HTML/RSC caching, so a later env disable cannot serve old prices/legal pages', async () => {
  expect((await getCommerceState()).open).toBe(true)
  expect(next.unstable_noStore).toHaveBeenCalledOnce()
})

it('closed quote pages retain ISR and the missing capability never touches the DB', async () => {
  delete process.env.PAYMENTS_ENABLED
  expect((await getCommerceState()).open).toBe(false)
  expect(db.findGlobal).not.toHaveBeenCalled()
  expect(next.unstable_noStore).not.toHaveBeenCalled()
})

it('DB failure stays closed and does not cache any open surface', async () => {
  db.findGlobal.mockRejectedValueOnce(new Error('unavailable'))
  expect((await getCommerceState()).open).toBe(false)
  expect(next.unstable_noStore).not.toHaveBeenCalled()
})

it('static-render bailouts escape both the DB catch and the product content fallback', async () => {
  const bailout = new Error('static render bailout')
  next.unstable_noStore.mockImplementation(() => { throw bailout })
  await expect(getCommerceState()).rejects.toBe(bailout)
  await expect(getProductDetail('tr', 'family', 'product')).rejects.toBe(bailout)
})

it('P7: draft/missing/one-locale legal pages keep the surface closed; the legal read happens only when everything else is open', async () => {
  const kinds = ['distanceSales', 'preInformation', 'refund']
  db.find.mockImplementation(async ({ locale }: { locale: string }) => ({
    docs: kinds.map((commerceLegal) => ({ commerceLegal, layout: commerceLegal === 'refund' && locale === 'en' ? [{ content: 'TASLAK — x' }] : [] })),
  }))
  expect((await getCommerceState())).toMatchObject({ open: false, legalReady: false })
  expect(next.unstable_noStore).not.toHaveBeenCalled()
  db.find.mockResolvedValue({ docs: LEGAL.slice(0, 2) })
  expect((await getCommerceState()).open).toBe(false)
  db.find.mockRejectedValue(new Error('down'))
  expect((await getCommerceState()).open).toBe(false)
  db.find.mockClear()
  db.findGlobal.mockResolvedValue({ commerce: { mode: 'quote-only' } })
  expect((await getCommerceState()).open).toBe(false)
  expect(db.find).not.toHaveBeenCalled()
})
