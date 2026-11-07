import { beforeEach, describe, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({
  create: vi.fn(),
  sendEmail: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  find: vi.fn(),
  limit: vi.fn(),
  verify: vi.fn(),
  form: vi.fn(),
  origin: 'http://127.0.0.1:3100' as string | null,
}))
vi.mock('next/headers', () => ({
  headers: async () => {
    const h = new Headers({
      host: '127.0.0.1:3100',
      'x-forwarded-for': '203.0.113.1',
    })
    if (mock.origin !== null) h.set('origin', mock.origin)
    return h
  },
}))
vi.mock('@/lib/site', () => ({
  getPayloadClient: async () => ({
    create: mock.create,
    sendEmail: mock.sendEmail,
    logger: { info: mock.info, error: mock.error },
  }),
}))
vi.mock('@/lib/content', () => ({
  getContactSettings: async () => ({ contact: { email: 'staff@example.com' } }),
}))
vi.mock('@/lib/support', () => ({
  getSupportProducts: async () => [{ id: 1, slug: 'p' }],
  getSupportEditions: async () => [{ sku: 'P-PRO', product: 1 }],
}))
vi.mock('@/lib/forms/data', () => ({ getLeadForm: mock.form }))
vi.mock('@/lib/forms/security', () => ({
  allowSubmission: mock.limit,
  requestIP: () => '203.0.113.1',
  verifyTurnstile: mock.verify,
}))
import { submitLead } from '@/lib/forms/action'
function data(changes: Record<string, string> = {}) {
  const f = new FormData()
  for (const [k, v] of Object.entries({
    kind: 'quote',
    locale: 'tr',
    name: 'Test User',
    email: 'user@example.com',
    company: '',
    phone: '',
    message: 'A valid request message',
    consent: 'on',
    website: '',
    product: 'p',
    sku: 'P-PRO',
    ...changes,
  }))
    f.set(k, v)
  return f
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.origin = 'http://127.0.0.1:3100'
  vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'http://127.0.0.1:3100')
  vi.stubEnv('FORM_NOTIFICATION_EMAIL', '')
  mock.limit.mockReturnValue(true)
  mock.verify.mockResolvedValue(true)
  mock.form.mockResolvedValue({ id: 2 })
  mock.create.mockResolvedValue({ id: 99 })
  mock.sendEmail.mockResolvedValue(undefined)
})
describe('lead server action', () => {
  it('rejects absent or cross-origin requests before recording a submission', async () => {
    for (const origin of [null, 'https://evil.example']) {
      mock.origin = origin
      expect((await submitLead({ status: 'idle' }, data())).status).toBe('error')
    }
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('only writes validated submissions with server override and fixed email headers', async () => {
    expect(await submitLead({ status: 'idle' }, data())).toEqual({ status: 'success' })
    const options = mock.create.mock.calls[0][0]
    expect(options).toMatchObject({
      collection: 'form-submissions',
      overrideAccess: true,
      data: { form: 2 },
    })
    expect(options.data.submissionData).toContainEqual({ field: 'sku', value: 'P-PRO' })
    expect(mock.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'staff@example.com',
      subject: 'SoftMarket: quote request',
    })
    expect(mock.sendEmail.mock.calls[0][0]).not.toHaveProperty('replyTo')
  })
  it('does not write honeypots, invalid inputs, failed verification or rate-limited requests', async () => {
    expect(await submitLead({ status: 'idle' }, data({ website: 'bot' }))).toEqual({
      status: 'success',
    })
    expect(mock.verify).not.toHaveBeenCalled()
    expect((await submitLead({ status: 'idle' }, data({ consent: '' }))).status).toBe('invalid')
    mock.verify.mockResolvedValue(false)
    expect((await submitLead({ status: 'idle' }, data())).status).toBe('verification')
    mock.limit.mockReturnValue(false)
    expect((await submitLead({ status: 'idle' }, data())).status).toBe('rate')
    expect(mock.create).not.toHaveBeenCalled()
  })
  it('ignores a SKU that does not belong to the selected public product', async () => {
    await submitLead({ status: 'idle' }, data({ product: 'missing' }))
    expect(mock.create.mock.calls[0][0].data.submissionData).toContainEqual({
      field: 'sku',
      value: '',
    })
  })
  it('keeps a persisted submission successful when notification fails', async () => {
    mock.sendEmail.mockRejectedValue(new Error('SMTP down'))
    expect(await submitLead({ status: 'idle' }, data())).toEqual({ status: 'success' })
    expect(mock.error).toHaveBeenCalled()
  })
  it('cannot post arbitrary form IDs or duplicate required fields', async () => {
    const f = data()
    f.set('form', '999')
    f.append('consent', 'on')
    expect((await submitLead({ status: 'idle' }, f)).status).toBe('invalid')
    expect(mock.create).not.toHaveBeenCalled()
  })
})
