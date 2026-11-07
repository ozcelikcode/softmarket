import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

const callbacks = vi.hoisted(() => [] as (() => Promise<void>)[])
vi.mock('next/server', () => ({ after: (work: () => Promise<void>) => callbacks.push(work) }))
import { authResponse, queueAuthEmail } from '@/lib/portal/auth-work'

afterEach(() => { callbacks.length = 0 })
describe('enumeration-resistant auth responses', () => {
  it('pads fast successful and failed paths to the same minimum duration', async () => {
    let started = performance.now()
    expect(await authResponse(async () => 'success')).toBe('success')
    expect(performance.now() - started).toBeGreaterThanOrEqual(790)
    started = performance.now()
    await expect(authResponse(async () => { throw new Error('duplicate or absent') })).rejects.toThrow('duplicate or absent')
    expect(performance.now() - started).toBeGreaterThanOrEqual(790)
  })
  it('keeps SMTP latency/failure out of the public response and logs no personal data', async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error('SMTP failure containing private data'))
    const error = vi.fn()
    const payload = { sendEmail, logger: { error } } as unknown as Payload
    queueAuthEmail(payload, { email: 'ada@example.test' }, 'secret-token', 'verify')
    expect(sendEmail).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)
    await expect(callbacks[0]()).resolves.toBeUndefined()
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.test', subject: expect.any(String) }))
    expect(error).toHaveBeenCalledWith('Portal authentication email delivery failed.')
  })
})
