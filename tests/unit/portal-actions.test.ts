import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from 'payload'

const mock = vi.hoisted(() => ({
  headers: new Headers({ host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' }),
  customer: { id: 7, collection: 'customers', email: 'ada@example.test' },
  req: { context: {}, transactionID: 'qa-transaction' },
  payload: { create: vi.fn(), update: vi.fn(), find: vi.fn(), findByID: vi.fn(), login: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), db: { findOne: vi.fn() } },
  setSession: vi.fn(), clearSession: vi.fn(), endSession: vi.fn(),
  commit: vi.fn(), rollback: vi.fn(), email: vi.fn(), dummy: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: async () => mock.headers }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`) } }))
vi.mock('payload', async (original) => ({
  ...await original<typeof import('payload')>(),
  createLocalReq: vi.fn(async () => mock.req), initTransaction: vi.fn(async () => true),
  commitTransaction: mock.commit, killTransaction: mock.rollback,
}))
vi.mock('@/lib/site', () => ({ getPayloadClient: async () => mock.payload }))
vi.mock('@/lib/portal/session', () => ({ getCustomer: async () => mock.customer, setSession: mock.setSession, clearSession: mock.clearSession, endSession: mock.endSession }))
vi.mock('@/lib/portal/auth-work', () => ({ authResponse: async (work: () => unknown) => work(), queueAuthEmail: mock.email, dummyPasswordCheck: mock.dummy }))
vi.mock('@/lib/portal/guard', async (original) => ({
  ...await original<typeof import('@/lib/portal/guard')>(), allowAuthAttempt: () => true, allowCustomerAction: () => true,
}))
vi.mock('@/lib/forms/security', () => ({ createRateLimiter: () => () => true, requestIP: () => 'unknown', verifyTurnstile: async () => true }))

import { changePasswordAction, createTicketAction, forgotPasswordAction, loginAction, registerAction, replyTicketAction, revealLicenseKeyAction, updateProfileAction } from '@/lib/portal/actions'

const state = { status: 'idle' } as const
const form = (values: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries({ locale: 'tr', ...values })) data.set(key, value)
  return data
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.headers = new Headers({ host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' })
  mock.payload.find.mockResolvedValue({ docs: [{ id: 1, product: { id: 12, title: 'Licensed product' }, status: 'active', startsAt: new Date(0).toISOString() }] })
})

describe('portal action boundaries', () => {
  it('drops injected profile fields before updating the authenticated customer', async () => {
    const result = await updateProfileAction(state, form({ name: 'Ada', company: 'X', phone: '', taxNumber: '', email: 'attacker@example.test', _verified: 'true', password: 'injected', role: 'admin', kvkkConsentVersion: 'fake' }))
    expect(result).toEqual({ status: 'success' })
    expect(mock.payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 7, user: mock.customer, overrideAccess: false, data: { name: 'Ada', company: 'X', phone: '', taxNumber: '' } }))
  })
  it('refuses missing/cross-origin requests before touching customer data', async () => {
    mock.headers = new Headers({ host: '127.0.0.1:3100' })
    expect(await updateProfileAction(state, form({ name: 'Ada' }))).toEqual({ status: 'error' })
    mock.headers.set('origin', 'http://evil.test')
    expect(await revealLicenseKeyAction(1)).toEqual({ key: null })
    expect(mock.payload.update).not.toHaveBeenCalled()
    expect(mock.payload.findByID).not.toHaveBeenCalled()
  })
  it('never reveals a different customer license, even if a query returns it', async () => {
    mock.payload.findByID.mockResolvedValue({ key: 'secret', customer: 8 })
    expect(await revealLicenseKeyAction(1)).toEqual({ key: null })
    expect(mock.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'licenses', id: 1, user: mock.customer, overrideAccess: false }))
    mock.payload.findByID.mockResolvedValue({ key: 'owned-secret', customer: 7 })
    expect(await revealLicenseKeyAction(2)).toEqual({ key: 'owned-secret' })
  })
  it('refuses ticket creation for an unlicensed product', async () => {
    expect(await createTicketAction(state, form({ subject: 'Kurulum hatası', product: '99', body: 'Detaylı hata açıklaması.' }))).toEqual({ status: 'invalid', errors: { product: 'invalid' } })
    expect(mock.payload.create).not.toHaveBeenCalled()
  })
  it('rolls back the ticket if its first message cannot be saved', async () => {
    mock.payload.create.mockResolvedValueOnce({ id: 15 }).mockRejectedValueOnce(new Error('message failed'))
    expect(await createTicketAction(state, form({ subject: 'Kurulum hatası', product: '12', body: 'Detaylı hata açıklaması.' }))).toEqual({ status: 'error' })
    expect(mock.rollback).toHaveBeenCalledWith(mock.req)
    expect(mock.commit).not.toHaveBeenCalled()
    expect(mock.payload.create.mock.calls.every(([args]) => args.req === mock.req && args.overrideAccess === false)).toBe(true)
  })
  it('commits the ticket and first message together', async () => {
    mock.payload.create.mockResolvedValue({ id: 15 })
    await expect(createTicketAction(state, form({ subject: 'Kurulum hatası', product: '12', body: 'Detaylı hata açıklaması.' }))).rejects.toThrow('redirect:/tr/hesap/talepler/15')
    expect(mock.commit).toHaveBeenCalledWith(mock.req)
    expect(mock.payload.update).toHaveBeenCalledWith(expect.objectContaining({ req: { ...mock.req, user: null }, overrideAccess: true, data: { lastMessageAt: expect.any(String) } }))
  })
  it('does not lose entitlement when the usable license is older than the first 200 licenses', async () => {
    const licenses = Array.from({ length: 201 }, (_, i) => ({ id: i + 1, product: { id: 12, title: 'Licensed product' }, status: i === 200 ? 'active' : 'revoked', startsAt: new Date(0).toISOString() }))
    mock.payload.find.mockImplementation(async ({ limit }: { limit: number }) => ({ docs: limit === 0 ? licenses : licenses.slice(0, limit) }))
    mock.payload.create.mockResolvedValue({ id: 15 })
    await expect(createTicketAction(state, form({ subject: 'Kurulum hatası', product: '12', body: 'Detaylı hata açıklaması.' }))).rejects.toThrow('redirect:/tr/hesap/talepler/15')
  })
  it('rejects replies to foreign or closed tickets before writing a message', async () => {
    const data = form({ ticket: '42', body: 'Yanıt içeriği' })
    mock.payload.findByID.mockRejectedValueOnce(new Error('not found'))
    expect(await replyTicketAction(state, data)).toEqual({ status: 'error' })
    expect(mock.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ user: mock.customer, overrideAccess: false }))
    mock.payload.findByID.mockResolvedValueOnce({ id: 42, customer: 7, status: 'closed' })
    expect(await replyTicketAction(state, data)).toEqual({ status: 'closed' })
    expect(mock.payload.create).not.toHaveBeenCalled()
    expect(mock.rollback).toHaveBeenCalledTimes(2)
  })
  it('requires the old password and marks only the validated change as trusted', async () => {
    mock.payload.login.mockRejectedValueOnce(new Error('bad password'))
    const data = form({ current: 'wrong-password', password: 'new-password-1', confirm: 'new-password-1' })
    expect(await changePasswordAction(state, data)).toEqual({ status: 'currentPassword' })
    expect(mock.payload.update).not.toHaveBeenCalled()
    mock.payload.login.mockResolvedValue({ token: 'new-token', exp: 123 })
    expect(await changePasswordAction(state, data)).toEqual({ status: 'success' })
    expect(mock.payload.update).toHaveBeenCalledWith(expect.objectContaining({ context: { portalPasswordChange: true }, data: { password: 'new-password-1' }, overrideAccess: false }))
    expect(mock.setSession).toHaveBeenCalledWith('new-token', 123)
  })
  it('does dummy password work for absent accounts and returns generic credentials', async () => {
    mock.payload.db.findOne.mockResolvedValue(null)
    mock.payload.login.mockRejectedValue(new Error('unknown account'))
    expect(await loginAction(state, form({ email: 'absent@example.test', password: 'wrong' }))).toEqual({ status: 'credentials' })
    expect(mock.dummy).toHaveBeenCalledWith('wrong')
  })
  it('never accepts caller-supplied consent metadata during registration', async () => {
    mock.payload.create.mockResolvedValue({ email: 'ada@example.test', _verificationToken: 'verify-token' })
    expect(await registerAction(state, form({ name: 'Ada', email: 'ada@example.test', password: 'long-password-1', confirm: 'long-password-1', consent: 'on', kvkkConsentAt: 'fake', kvkkConsentVersion: 'fake', _verified: 'true' }))).toEqual({ status: 'success' })
    const args = mock.payload.create.mock.calls[0][0]
    expect(args.context).toEqual({ portalRegistration: true })
    expect(args.disableVerificationEmail).toBe(true)
    expect(args.data).not.toHaveProperty('kvkkConsentAt')
    expect(args.data).not.toHaveProperty('_verified')
    expect(mock.email).toHaveBeenCalledTimes(1)
  })
  it('returns the same forgot response for present/absent accounts and defers SMTP', async () => {
    mock.payload.forgotPassword.mockResolvedValueOnce(null).mockResolvedValueOnce('reset-token')
    const data = form({ email: 'ada@example.test' })
    expect(await forgotPasswordAction(state, data)).toEqual({ status: 'success' })
    mock.payload.find.mockResolvedValue({ docs: [{ email: 'ada@example.test' }] })
    expect(await forgotPasswordAction(state, data)).toEqual({ status: 'success' })
    expect(mock.payload.forgotPassword).toHaveBeenCalledWith(expect.objectContaining({ disableEmail: true }))
    expect(mock.email).toHaveBeenCalledTimes(1)
  })
  it('does matching password work and returns success for duplicate registration', async () => {
    mock.payload.create.mockRejectedValue(new ValidationError({ collection: 'customers', errors: [{ path: 'email', message: 'Duplicate' }] }))
    expect(await registerAction(state, form({ name: 'Ada', email: 'ada@example.test', password: 'long-password-1', confirm: 'long-password-1', consent: 'on' }))).toEqual({ status: 'success' })
    expect(mock.dummy).toHaveBeenCalledWith('long-password-1')
    expect(mock.email).not.toHaveBeenCalled()
  })
})
