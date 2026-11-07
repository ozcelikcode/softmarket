import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { License } from '@/payload-types'
import type { PayloadRequest } from 'payload'
import { forbiddenActionOrigin, legacySearchPath } from '@/lib/request-guards'
import { emailTemplate } from '@/lib/email/template'
import { notifyLicenseAssigned } from '@/lib/email/license-assigned'
import { searchFields } from '@/lib/search-index'
import { verifyEmailHTML, resetEmailHTML } from '@/lib/portal/email'

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>)
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => scheduled.push(fn) }))

const headers = (origin?: string, host = '127.0.0.1:3100') => new Headers({ host, 'next-action': 'action', ...(origin ? { origin } : {}) })
describe('request guards', () => {
  it('rejects missing, malformed, foreign and null action origins', () => {
    for (const origin of [undefined, 'null', 'broken', 'https://evil.test', 'http://127.0.0.1:3101']) {
      expect(forbiddenActionOrigin('POST', headers(origin))).toBe(true)
    }
  })
  it('allows same host actions without trusting forwarded hosts', () => {
    expect(forbiddenActionOrigin('POST', headers('http://127.0.0.1:3100'))).toBe(false)
    const h = headers('https://evil.test'); h.set('x-forwarded-host', 'evil.test')
    expect(forbiddenActionOrigin('POST', h)).toBe(true)
    expect(forbiddenActionOrigin('GET', h)).toBe(false)
    expect(forbiddenActionOrigin('POST', new Headers())).toBe(false)
  })
  it('maps legacy routes without redirecting the canonical English route', () => {
    expect(legacySearchPath('/tr/arama')).toBe('/tr/ara')
    expect(legacySearchPath('/en/arama')).toBe('/en/search')
    expect(legacySearchPath('/en/search')).toBeNull()
  })
})
describe('search synchronization', () => {
  it('includes localized titles, slugs and descriptions including FAQ questions', () => {
    expect(searchFields({ title: 'Workflow', slug: 'workflow', summary: 'English summary' })).toEqual({ title: 'Workflow', slug: 'workflow', excerpt: 'English summary' })
    expect(searchFields({ question: 'Nasıl?', slug: 'nasil' })).toEqual({ title: 'Nasıl?', slug: 'nasil', excerpt: null })
  })
})
describe('shared email templates', () => {
  it('escapes all variable HTML and excludes unsafe action links', () => {
    const html = emailTemplate({ locale: 'en', title: '<title>', body: '<script>', rows: [['<key>', '"<img>']], action: { label: 'Click', url: 'javascript:alert(1)' } })
    expect(html).toContain('lang="en"')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&quot;&lt;img&gt;')
    expect(html).not.toContain('javascript:')
  })
  it('uses the shared wrapper for localized auth messages and encodes tokens', () => {
    expect(verifyEmailHTML({ token: 'a&b', user: { preferredLocale: 'en' } })).toContain('/en/account/verify?token=a%26b')
    expect(resetEmailHTML({ token: 'x' })).toContain('<html lang="tr">')
  })
})

describe('license assignment email', () => {
  beforeAll(() => { vi.stubEnv('SMTP_HOST', 'smtp.example.test'); vi.stubEnv('SMTP_FROM', 'sender@example.test') })
  afterAll(() => vi.unstubAllEnvs())
  const doc = { id: 7, customer: 1, edition: 2, key: 'SECRET-KEY', expiresAt: '2027-01-15T00:00:00Z' } as License
  function request(locale = 'tr') {
    return { payload: {
      findByID: vi.fn().mockImplementation(({ collection }) => Promise.resolve(collection === 'licenses' ? doc : collection === 'customers'
        ? { email: 'customer@example.test', preferredLocale: locale }
        : collection === 'editions' ? { title: 'Pro', sku: 'PRO', product: 3 } : { title: '<Product>' })),
      sendEmail: vi.fn().mockResolvedValue({}), logger: { error: vi.fn() },
    } } as unknown as PayloadRequest
  }
  it.each(['tr', 'en'])('sends key, localized product/edition and expiry in %s on create only', async (locale) => {
    const req = request(locale)
    await notifyLicenseAssigned({ doc, operation: 'create', req } as Parameters<typeof notifyLicenseAssigned>[0])
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
    await scheduled.shift()!()
    expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'products', locale }))
    expect(req.payload.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'customer@example.test', text: expect.stringContaining('SECRET-KEY'), html: expect.stringContaining('&lt;Product&gt;'),
    }))
    const mail = vi.mocked(req.payload.sendEmail).mock.calls[0][0]
    expect(mail.text).toContain('Pro (PRO)')
    expect(mail.text).toContain('2027')
    await notifyLicenseAssigned({ doc, operation: 'update', req } as Parameters<typeof notifyLicenseAssigned>[0])
    expect(req.payload.sendEmail).toHaveBeenCalledTimes(1)
  })
  it('handles perpetual licenses and retains assignment when SMTP fails', async () => {
    const req = request('en')
    vi.mocked(req.payload.sendEmail).mockRejectedValue(new Error('SMTP private details'))
    const perpetual = { ...doc, expiresAt: null }
    await expect(notifyLicenseAssigned({ doc: perpetual, operation: 'create', req } as Parameters<typeof notifyLicenseAssigned>[0])).resolves.toEqual(perpetual)
    await scheduled.shift()!()
    expect(req.payload.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('Perpetual') }))
    expect(req.payload.logger.error).toHaveBeenCalledWith('License assignment email failed; license retained.')
  })
  it('retains assignment if customer lookup fails', async () => {
    const req = request()
    vi.mocked(req.payload.findByID).mockRejectedValue(new Error('lookup failed'))
    await expect(notifyLicenseAssigned({ doc, operation: 'create', req } as Parameters<typeof notifyLicenseAssigned>[0])).resolves.toEqual(doc)
    await scheduled.shift()!()
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
  })
  it('does not send if the assignment was rolled back or its id was reused', async () => {
    const req = request()
    vi.mocked(req.payload.findByID).mockResolvedValueOnce({ ...doc, key: 'DIFFERENT' } as never)
    await notifyLicenseAssigned({ doc, operation: 'create', req } as Parameters<typeof notifyLicenseAssigned>[0])
    await scheduled.shift()!()
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
  })
  it('does not leak the license key to the console adapter when SMTP is absent', async () => {
    const req = request()
    vi.stubEnv('SMTP_HOST', '')
    await notifyLicenseAssigned({ doc, operation: 'create', req } as Parameters<typeof notifyLicenseAssigned>[0])
    expect(req.payload.sendEmail).not.toHaveBeenCalled()
    expect(scheduled).toHaveLength(0)
    vi.stubEnv('SMTP_HOST', 'smtp.example.test')
  })
})
