import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { observeWebhookSignatureRejection } from '@/lib/licensing/events/anomalies'
import { ipPrivacy } from '@/lib/licensing/crypto/ip'
import { deliverLicensingNotifications } from '@/lib/licensing/rules/notify'
import { normalizeSweepSettings } from '@/lib/licensing/rules/settings'
import { readPaymentsEnv } from '@/lib/payments/env'
import { handleProviderWebhook } from '@/lib/payments/events'
import { createPaymentsDeps } from '@/lib/payments/runtime'
import { computeStripeSignature } from '@/lib/payments/signature/stripe'
import { ADMIN, CUSTOMER, EDITOR, ORIGIN, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { captureLog, stubMail } from './helpers/licensing-sweep'

const mock = vi.hoisted(() => ({
  jobs: [] as (() => Promise<void>)[],
  headers: new Headers(),
  payload: undefined as Ctx['payload'] | undefined,
  setSession: vi.fn(),
}))
vi.mock('next/server', async (original) => ({
  ...await original<typeof import('next/server')>(),
  after: (job: () => Promise<void>) => { mock.jobs.push(job) },
}))
vi.mock('next/headers', () => ({ headers: async () => mock.headers }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/navigation', async (original) => ({
  ...await original<typeof import('next/navigation')>(),
  redirect: () => { throw new Error('portal redirect') },
}))
vi.mock('@/lib/site', async (original) => ({
  ...await original<typeof import('@/lib/site')>(),
  getPayloadClient: async () => mock.payload,
}))
vi.mock('@/lib/portal/session', async (original) => ({
  ...await original<typeof import('@/lib/portal/session')>(),
  setSession: mock.setSession,
}))
vi.mock('@/lib/portal/auth-work', async (original) => ({
  ...await original<typeof import('@/lib/portal/auth-work')>(),
  authResponse: async (work: () => Promise<unknown>) => work(),
}))
vi.mock('@/lib/portal/guard', async (original) => ({
  ...await original<typeof import('@/lib/portal/guard')>(),
  allowAuthAttempt: () => true,
}))

let ctx: Ctx
const proxySecret = 'test-proxy-secret-for-anomalies-12345'
const stripeSecret = 'whsec_L8Test000000000000'
const testIp = '192.0.2.123'
const network = (ip: string) => ({
  'x-softmarket-client-ip': ip, 'x-softmarket-proxy-secret': proxySecret,
})
const flush = async () => { await Promise.all(mock.jobs.splice(0).map((job) => job())) }
const rows = async () => (await ctx.run('SELECT * FROM security_events ORDER BY id')).rows
const panel = (body: typeof ADMIN, ip = testIp) => {
  ctx.headers.anonymous = { origin: ORIGIN, ...network(ip) }
  return ctx.rest('POST', 'users/login', 'anonymous', body)
}
const portal = async (body: typeof CUSTOMER) => {
  const { loginAction } = await import('@/lib/portal/actions')
  const form = new FormData()
  for (const [key, value] of Object.entries({ ...body, locale: 'en' })) form.set(key, value)
  return loginAction({ status: 'idle' }, form)
}

beforeAll(async () => {
  ctx = await setupLicensingDb('l8-anomalies')
  await ctx.run('INSERT OR IGNORE INTO site_settings(id) VALUES (1)')
  mock.payload = ctx.payload
  vi.stubEnv('FORM_PROXY_SECRET', proxySecret)
  vi.stubEnv('SOFTMARKET_SECRETS_KEY', 'ab'.repeat(32))
}, 240_000)
afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await ctx?.destroy() })
beforeEach(async () => {
  await flush()
  vi.setSystemTime(new Date('2026-11-18T11:30:00Z'))
  await ctx.run('DELETE FROM security_events')
  for (const table of ['users', 'customers']) await ctx.run(`UPDATE ${table} SET login_attempts = 0, lock_until = NULL`)
  mock.headers = new Headers({ host: '127.0.0.1:3100', origin: ORIGIN, ...network(testIp) })
  mock.setSession.mockClear()
})

describe('L8 identity observations through the normal login entry points', () => {
  it('coalesces by known account or by prefix, and records one Payload panel lockout', async () => {
    for (let i = 0; i < 7; i++) {
      expect((await panel({ ...ADMIN, password: 'wrong-private-password' }, i % 2 ? testIp : '198.51.100.10')).status).toBe(401)
    }
    for (const email of ['absent-one@example.test', 'absent-two@example.test']) {
      expect((await panel({ email, password: 'wrong' })).status).toBe(401)
    }
    expect(await rows()).toEqual([])
    await flush()
    expect((await panel({ ...ADMIN, password: 'still-wrong' })).status).toBe(401)
    await flush()
    const events = await rows()
    expect(events).toEqual([
      expect.objectContaining({ type: 'auth.admin_login_failed', count: 8, actor_user_id: ctx.ids.admin }),
      expect.objectContaining({ type: 'auth.admin_locked', count: 1, actor_user_id: ctx.ids.admin }),
      expect.objectContaining({ type: 'auth.admin_login_failed', count: 2, actor_user_id: null, ip_prefix: '192.0.2.0/24' }),
    ])
    expect(JSON.stringify(events)).not.toMatch(/@example\.test|wrong-private-password|192\.0\.2\.123|198\.51\.100\.10|test-proxy-secret/)
  })

  it('logs a portal success and aggregates portal credentials and lockout separately from panel identities', async () => {
    await expect(portal(CUSTOMER)).rejects.toThrow('portal redirect')
    for (let i = 0; i < 12; i++) {
      expect(await portal({ ...CUSTOMER, password: 'wrong-password' })).toEqual({ status: 'credentials' })
    }
    expect(mock.setSession).toHaveBeenCalledTimes(1)
    await flush()
    const events = await rows()
    expect(events).toEqual([
      expect.objectContaining({ type: 'auth.portal_login_failed', count: 1, severity: 'info', detail: '{"outcome":"success"}', customer_id: ctx.ids.customer }),
      expect.objectContaining({ type: 'auth.portal_login_failed', count: 12, severity: 'low', detail: '{"outcome":"failure"}', customer_id: ctx.ids.customer }),
      expect.objectContaining({ type: 'auth.portal_locked', count: 1, customer_id: ctx.ids.customer }),
    ])
  })

  it('queues an admin notice per new prefix, ignores untrusted headers and leaves editor successes informational', async () => {
    ctx.headers.anonymous = { origin: ORIGIN, 'x-softmarket-client-ip': testIp }
    expect((await ctx.rest('POST', 'users/login', 'anonymous', ADMIN)).status).toBe(200)
    expect((await panel(ADMIN)).status).toBe(200)
    expect((await panel(ADMIN, '192.0.2.99')).status).toBe(200)
    expect((await panel(ADMIN, '2001:db8:1111:2222::abcd')).status).toBe(200)
    expect((await panel(EDITOR, '2001:db8:3333:2222::abcd')).status).toBe(200)
    await flush()
    const events = await rows()
    expect(events.filter((row) => row.notify_state === 'pending')).toEqual([
      expect.objectContaining({ type: 'auth.admin_new_network', actor_user_id: ctx.ids.admin, ip_prefix: '192.0.2.0/24', ip_hash: ipPrivacy(testIp)?.hash }),
      expect.objectContaining({ type: 'auth.admin_new_network', actor_user_id: ctx.ids.admin, ip_prefix: '2001:db8:1111::/48' }),
    ])
    expect(events.filter((row) => row.severity === 'info')).toEqual([
      expect.objectContaining({ actor_user_id: ctx.ids.admin, ip_prefix: null, ip_hash: null }),
      expect.objectContaining({ actor_user_id: ctx.ids.admin, ip_prefix: '192.0.2.0/24' }),
      expect.objectContaining({ actor_user_id: ctx.ids.editor, ip_prefix: '2001:db8:3333::/48' }),
    ])
    const mail = stubMail(ctx.payload)
    try {
      const deliver = () => deliverLicensingNotifications(ctx.payload, {
        ...normalizeSweepSettings({}), alertEmails: ['ops@example.test'], minSeverityImmediate: 'critical',
      }, { now: () => new Date(), origin: 'https://site.test', log: captureLog().log })
      expect((await deliver()).sent.admin).toBe(2)
      expect((await deliver()).claimed).toBe(0)
      expect(mail.sent).toHaveLength(1)
      expect(mail.sent[0]!.text).toContain('auth.admin_new_network')
      expect(mail.sent[0]!.text).not.toMatch(/192\.0\.2|2001:db8|admin\.l1@example\.test/)
    } finally {
      mail.restore()
    }
  })

  it('uses recent successes for the same admin, including across the monthly hash boundary', async () => {
    vi.setSystemTime(new Date('2026-11-30T23:59:00Z'))
    expect((await panel(ADMIN)).status).toBe(200)
    await flush()
    vi.setSystemTime(new Date('2026-12-01T00:01:00Z'))
    expect((await panel(ADMIN)).status).toBe(200)
    await flush()
    vi.setSystemTime(new Date('2026-12-09T00:01:00Z'))
    expect((await panel(ADMIN)).status).toBe(200)
    await flush()
    const events = await rows()
    expect(events.map((row) => row.type)).toEqual(['auth.admin_new_network', 'auth.admin_login_failed', 'auth.admin_new_network'])
    expect(events[0]!.ip_hash).not.toBe(events[1]!.ip_hash)
  })
})

describe('L8 unauthenticated row growth', () => {
  it('folds networks beyond the hourly cap into one overflow row without losing the count', async () => {
    const at = new Date('2026-11-18T11:30:00Z')
    for (let i = 0; i < 30; i++) {
      observeWebhookSignatureRejection(ctx.payload, 'stripe', new Headers(network(`203.0.${i}.9`)), at)
    }
    observeWebhookSignatureRejection(ctx.payload, 'stripe', new Headers(network('203.0.3.77')), at)
    await flush()
    const events = await rows()
    expect(events).toHaveLength(21)
    expect(events.reduce((sum, row) => sum + Number(row.count), 0)).toBe(31)
    expect(events.filter((row) => row.ip_prefix === null)).toEqual([expect.objectContaining({ count: 10 })])
    expect(events.find((row) => row.ip_prefix === '203.0.3.0/24')).toEqual(expect.objectContaining({ count: 2 }))
  })
})

describe('L8 webhook response regression', () => {
  it.each(['iyzico', 'stripe'] as const)('preserves exact open and closed rejection responses for %s', async (provider) => {
    const at = new Date('2026-11-18T11:30:00Z')
    const env = readPaymentsEnv({
      PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'sandbox-L8Test', IYZICO_SECRET_KEY: 'L8TestSecret',
      IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com',
      PAYMENTS_STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_L8Test', STRIPE_WEBHOOK_SECRET: stripeSecret,
    })
    const { log, lines } = captureLog()
    const deps = createPaymentsDeps(ctx.payload, { env, log, now: () => at, origin: ORIGIN })
    const body = provider === 'iyzico'
      ? JSON.stringify({ iyziEventType: 'CHECKOUT_FORM_AUTH', status: 'SUCCESS', paymentConversationId: 'private-body', paymentId: '123' })
      : '{"id":"evt_L8","type":"private-body"}'
    const sig: Record<string, string> = provider === 'iyzico' ? { 'x-iyz-signature-v3': 'f'.repeat(64) }
      : { 'stripe-signature': `t=${at.getTime() / 1000},v1=${'f'.repeat(64)}` }
    const send = (headers: Record<string, string> = {}, data = body) => handleProviderWebhook(deps, provider, new Request(
      `${ORIGIN}/api/payments/${provider}/webhook`,
      { method: 'POST', body: data, headers: { ...network(testIp), ...headers } },
    ))
    const unchanged = async (response: Response, status: number) => {
      expect(response.status).toBe(status)
      expect(response.statusText).toBe('')
      expect([...response.headers.entries()]).toEqual([['cache-control', 'no-store']])
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array())
    }

    await ctx.run("UPDATE site_settings SET commerce_mode = 'payments'")
    await unchanged(await send(), 400)
    await unchanged(await send(sig), 400)
    if (provider === 'stripe') {
      await unchanged(await send({ 'stripe-signature': 'private-header' }), 400)
      const t = at.getTime() / 1000
      const signedMalformed = computeStripeSignature('{', stripeSecret, t)
      await unchanged(await send({ 'stripe-signature': `t=${t},v1=${signedMalformed}` }, '{'), 400)
    }
    await unchanged(await send({}, 'x'.repeat(257 * 1024)), 413)
    await ctx.run("UPDATE site_settings SET commerce_mode = 'quote-only', commerce_quote_since = NULL")
    await unchanged(await send(), 404)
    expect(await rows()).toEqual([])
    await flush()
    const events = await rows()
    expect(events).toEqual([expect.objectContaining({
      type: 'webhook.bad_signature', source: 'webhook', count: provider === 'stripe' ? 4 : 3,
      detail: JSON.stringify({ provider }), ip_prefix: '192.0.2.0/24', ip_hash: ipPrivacy(testIp, process.env, at)?.hash,
    })])
    expect(JSON.stringify(events) + lines.join('')).not.toMatch(/private-body|private-header|192\.0\.2\.123|test-proxy-secret/)

    // A failed background write cannot change the rejection or wedge later observations.
    const begin = vi.spyOn(ctx.payload.db, 'beginTransaction').mockRejectedValueOnce(new Error('private-db-error'))
    try {
      await unchanged(await send(), 404)
      await flush()
      expect(await rows()).toEqual(events)
      await unchanged(await send(), 404)
      await flush()
      expect(await rows()).toEqual([expect.objectContaining({ count: Number(events[0]?.count) + 1 })])
      expect(lines.join('')).not.toContain('private-db-error')
    } finally {
      begin.mockRestore()
    }
  })
})
