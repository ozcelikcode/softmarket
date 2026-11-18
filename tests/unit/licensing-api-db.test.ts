import { inspect } from 'node:util'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'

import { createLicensingPost, flushLicensingObservations } from '@/lib/licensing/api/route'
import type { Endpoint } from '@/lib/licensing/api/guard'
import { hashDeviceFingerprint } from '@/lib/licensing/crypto/hmac'
import { verifyLease } from '@/lib/licensing/crypto/jws'
import { deviceKeyThumbprint, type SigningKeyMetadata } from '@/lib/licensing/crypto/keys'
import { provisionSigningKey } from '@/lib/licensing/signing'
import type { License, LicensingSetting } from '@/payload-types'
import {
  activateBody, DEVICE_IP, enableLicensingFixture, ISSUER, leasePayload, makeDevice,
  PRODUCT, PROXY_SECRET, randomToken, signedRequest, validateBody, verifyResponse,
} from './helpers/licensing-client'
import { CUSTOMER, setupLicensingDb, type Ctx } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

let ctx: Ctx
let key: SigningKeyMetadata
let now: Date
const date = () => new Date(now)
const epoch = () => Math.floor(now.getTime() / 1000)
const handlers = Object.fromEntries((['activate', 'validate', 'deactivate'] as const).map((endpoint) => [
  endpoint, createLicensingPost(endpoint, { loadPayload: async () => ctx.payload, now: date }),
])) as Record<Endpoint, (r: Request) => Promise<Response>>
const create = async (data: Partial<License> = {}) => ctx.payload.create({
  collection: 'licenses', depth: 0, data: {
    customer: ctx.ids.customer, edition: ctx.ids.edition, startsAt: '2026-01-01T00:00:00.000Z', key: '', status: 'active', ...data,
  }, context: { paymentsOrderFulfilment: true },
})
type SettingsPatch = Partial<Omit<LicensingSetting, 'limits' | 'selfService'>> & {
  limits?: Partial<LicensingSetting['limits']>; selfService?: Partial<LicensingSetting['selfService']>
}
const settings = (data: SettingsPatch) =>
  ctx.payload.updateGlobal({ slug: 'licensing-settings', data })

type RequestOptions = NonNullable<Parameters<typeof signedRequest>[3]>
function build(endpoint: Endpoint, body: object | string, device: ReturnType<typeof makeDevice>, options?: RequestOptions) {
  return signedRequest(endpoint, body, device, { timestamp: epoch(), ...options })
}

async function send(endpoint: Endpoint, call: ReturnType<typeof build>, signed = true) {
  const response = await handlers[endpoint](call.request)
  const raw = await response.text()
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex')
  if (signed) {
    expect(response.headers.get('SM-Key-Id')).toBe(key.kid)
    expect(verifyResponse(response.status, raw, response.headers.get('SM-Response-Signature')!, call.nonce, key.publicKey)).toBe(true)
  }
  return { status: response.status, headers: response.headers, body: JSON.parse(raw) }
}

async function open(license: License, device = makeDevice(), options?: RequestOptions) {
  const result = await send('activate', build('activate', activateBody(license.key, device), device, options))
  expect(result.status).toBe(200)
  const { activationId, lease } = result.body as { activationId: string; lease: string }
  return { device, activation: activationId, ctr: leasePayload(lease).ctr, lease }
}

const error = (status: number, code: string) => ({ status, body: { error: { code }, serverTime: expect.any(Number) } })

beforeAll(async () => {
  vi.stubEnv('FORM_PROXY_SECRET', PROXY_SECRET)
  vi.stubEnv('SOFTMARKET_SECRETS_KEY', randomToken(32))
  vi.stubEnv('SOFTMARKET_LICENSE_SIGNING_KEY', '')
  now = new Date()
  ctx = await setupLicensingDb('l3-api')
  await enableLicensingFixture(ctx.payload, ctx.ids.product)
  key = await provisionSigningKey(ctx.payload)
}, 240_000)
afterEach(async () => { await flushLicensingObservations(ctx.payload); vi.restoreAllMocks() })
afterAll(async () => { await ctx?.destroy(); vi.unstubAllEnvs() })

it('binds a lease to both public IDs, clips expiry and debounces last-seen observations', async () => {
  const expiresAt = new Date(now.getTime() + 3 * 86_400_000).toISOString()
  const license = await create({ maxDevices: 1, expiresAt })
  const first = await open(license, makeDevice(), { origin: 'https://untrusted-host.example.test' })
  const claims = leasePayload(first.lease)
  expect(claims).toMatchObject({
    iss: ISSUER, aud: PRODUCT, sub: first.activation, lid: `lic_${license.publicId}`, sku: 'L1-PRO', seats: 1,
    lexp: expiresAt, exp: Math.floor(Date.parse(expiresAt) / 1000), rfa: epoch() + 86400,
  })
  const expected = { iss: ISSUER, aud: PRODUCT, sub: first.activation, lid: `lic_${license.publicId}`,
    fp: first.device.fingerprint, dkt: deviceKeyThumbprint(first.device.publicKey)! }
  expect(verifyLease(first.lease, { keys: [key], expected, now: epoch() })).toEqual(claims)
  expect(verifyLease(first.lease, { keys: [key], expected: { ...expected, lid: `lic_${'1'.repeat(24)}` }, now: epoch() })).toBeNull()
  const repeat = await open(license, first.device)
  expect(repeat.activation).toBe(first.activation)
  const at = now.toISOString()
  now = new Date(now.getTime() + 70 * 60_000)
  const fresh = await send('validate', build('validate', validateBody(first.ctr, first.device), first.device,
    { activation: first.activation, ip: '2001:db8:abcd::1234', headers: { 'CF-IPCountry': 'CA' } }))
  expect(fresh.status).toBe(200)
  const ctr = leasePayload(fresh.body.lease).ctr
  expect(ctr).not.toBe(first.ctr)
  const get = async () => (await ctx.run(`SELECT * FROM license_activations WHERE public_id = '${first.activation.slice(4)}'`)).rows[0]
  expect(await get()).toMatchObject({ counter: ctr, prev_counter: first.ctr, last_seen_at: at })
  await flushLicensingObservations(ctx.payload)
  expect(await get()).toMatchObject({ last_ip_prefix: '2001:db8:abcd::/48', last_seen_at: now.toISOString(), last_country: 'CA', app_version: '1.0.1' })
})

it('rejects a replay across handler instances, but acknowledges only the exact authenticated deactivate retry', async () => {
  const license = await create({ maxDevices: 1 })
  const device = makeDevice()
  const nonce = randomToken()
  const call = () => build('activate', activateBody(license.key, device), device, { nonce })
  expect((await send('activate', call())).status).toBe(200)
  const otherHandler = createLicensingPost('activate', { loadPayload: async () => ctx.payload, now: date })
  expect((await otherHandler(call().request)).status).toBe(401)
  const active = await open(license, device)
  const refreshNonce = randomToken()
  const validate = () => send('validate', build('validate', validateBody(active.ctr, device), device, { activation: active.activation, nonce: refreshNonce }))
  expect((await validate()).status).toBe(200)
  expect(await validate()).toMatchObject(error(401, 'invalid_signature'))
  const endNonce = randomToken()
  const end = (reason: string) => send('deactivate', build('deactivate', { reason }, device, { activation: active.activation, nonce: endNonce }))
  expect(await end('uninstall')).toMatchObject({ status: 200, body: { deactivated: true } })
  expect(await end('uninstall')).toMatchObject({ status: 200, body: { deactivated: true } })
  expect(await end('transfer')).toMatchObject(error(401, 'invalid_signature'))
  expect((await ctx.run(`SELECT count(*) AS n FROM security_audit WHERE nonce = '${endNonce}'`)).rows).toEqual([{ n: 1 }])
  expect(await send('validate', build('validate', validateBody(active.ctr, device), device, { activation: active.activation })))
    .toMatchObject(error(403, 'activation_revoked'))
  expect((await open(license)).activation).not.toBe(active.activation)
})

it.each(['activate', 'validate', 'deactivate'] as const)('enforces the %s wire, signature, skew and disabled contracts', async (endpoint) => {
  const license = await create()
  const { device, activation, ctr } = await open(license)
  const requestActivation = endpoint === 'activate' ? '-' : activation
  const body = endpoint === 'activate' ? activateBody(license.key, device) : endpoint === 'validate' ? validateBody(ctr, device) : {}
  const call = (changes?: RequestOptions, raw: object | string = body) =>
    send(endpoint, build(endpoint, raw, device, { activation: requestActivation, ...changes }))
  expect(await call(undefined, { ...body, unknown: true })).toMatchObject(error(400, 'bad_request'))
  expect(await call({ headers: { 'Content-Length': '8193' } })).toMatchObject(error(400, 'bad_request'))
  expect(await call({ headers: { 'SM-Signature': 'bad=' } })).toMatchObject(error(401, 'invalid_signature'))
  for (const skew of [-301, 301]) expect(await call({ timestamp: epoch() + skew })).toMatchObject(error(400, 'clock_skew'))
  await settings({ apiEnabled: false })
  try { expect(await call()).toMatchObject(error(503, 'unavailable')) }
  finally { await settings({ apiEnabled: true }) }
  for (const skew of [-300, 300]) expect((await call({ timestamp: epoch() + skew })).status).toBe(200)
})

it.each([
  ['suspended', {}, 'license_suspended'], ['revoked', {}, 'license_revoked'], ['expired', {}, 'license_expired'],
  ['active', { expiresAt: '2026-01-02T00:00:00.000Z' }, 'license_expired'],
  ['active', { startsAt: '2099-01-01T00:00:00.000Z' }, 'license_not_started'],
] as const)('denies activation and refresh when %s (%j)', async (status, dates, code) => {
  const license = await create()
  const { device, activation, ctr } = await open(license)
  await ctx.payload.update({ collection: 'licenses', id: license.id, data: { status, ...dates } })
  expect(await send('activate', build('activate', activateBody(license.key, device), device))).toMatchObject(error(403, code))
  expect(await send('validate', build('validate', validateBody(ctr, device), device, { activation }))).toMatchObject(error(403, code))
})

it('uses the same invalid-license response for an absent key, wrong product and unverified owner', async () => {
  const license = await create()
  const device = makeDevice()
  const base = activateBody(license.key, device)
  const outcomes: { ms: number; body: unknown }[][] = []
  const measure = async (body: typeof base) => {
    const start = performance.now()
    const result = await send('activate', build('activate', body, device, { ip: '198.51.8.2' }))
    expect(result).toMatchObject(error(401, 'invalid_license'))
    return { ms: performance.now() - start, body: result.body }
  }
  for (let i = 0; i < 5; i++) {
    outcomes.push([await measure({ ...base, licenseKey: 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA' }),
      await measure({ ...base, productCode: 'wrong-product' })])
  }
  const medians = [0, 1].map((index) => outcomes.map((pair) => pair[index]!.ms).sort((a, b) => a - b)[2]!)
  expect(Math.abs(medians[0]! - medians[1]!)).toBeLessThan(20)
  expect(outcomes[0]![0]!.body).toEqual(outcomes[0]![1]!.body)
  await ctx.run(`UPDATE customers SET _verified = 0 WHERE id = ${ctx.ids.customer}`)
  try { expect((await measure(base)).body).toEqual(outcomes[0]![0]!.body) }
  finally { await ctx.run(`UPDATE customers SET _verified = 1 WHERE id = ${ctx.ids.customer}`) }
})

it('allows rebind within the configured 30-day quota and rejects the old key and a second rebind', async () => {
  await settings({ selfService: { rebindsPer30Days: 1 } })
  try {
    const license = await create({ maxDevices: 1 })
    const first = await open(license)
    const second = await open(license, makeDevice(first.device.fingerprint))
    expect(second.activation).not.toBe(first.activation)
    expect(await send('validate', build('validate', validateBody(first.ctr, first.device), first.device, { activation: first.activation })))
      .toMatchObject(error(403, 'activation_revoked'))
    expect(await send('validate', build('validate', validateBody(second.ctr, second.device), first.device, { activation: second.activation })))
      .toMatchObject(error(401, 'invalid_signature'))
    const third = makeDevice(first.device.fingerprint)
    expect(await send('activate', build('activate', activateBody(license.key, third), third))).toMatchObject(error(409, 'rebind_limit'))
    expect(await send('activate', build('activate', activateBody(license.key, makeDevice()), third))).toMatchObject(error(401, 'invalid_signature'))
    expect((await ctx.run(`SELECT status, end_reason FROM license_activations WHERE license_id = ${license.id} ORDER BY id`)).rows)
      .toEqual([{ status: 'deactivated', end_reason: 'rebind' }, { status: 'active', end_reason: null }])
  } finally { await settings({ selfService: { rebindsPer30Days: 3 } }) }
})

it('compares device fingerprints, accepts one prior counter and aggregates suspect clones without changing license state', async () => {
  const license = await create()
  const { device, activation, ctr } = await open(license)
  const validate = (current: string, fingerprint = device.fingerprint) => send('validate', build(
    'validate', { ...validateBody(current, device), fingerprint }, device, { activation },
  ))
  expect(await validate(ctr, randomToken(32))).toMatchObject(error(401, 'invalid_signature'))
  expect((await validate(ctr)).status).toBe(200)
  expect((await validate(ctr)).status).toBe(200)
  await flushLicensingObservations(ctx.payload)
  const events = async () => (await ctx.run(`SELECT * FROM security_events WHERE license_id = ${license.id} AND type = 'activation.clone_suspected'`)).rows
  expect(await events()).toHaveLength(0)
  expect((await validate(ctr)).status).toBe(200)
  await flushLicensingObservations(ctx.payload)
  expect(await events()).toMatchObject([{ severity: 'low', count: 1 }])
  expect((await ctx.payload.findByID({ collection: 'licenses', id: license.id })).status).toBe('active')
})

it('applies configurable network, activation and license rate limits without per-rejection nonce rows', async () => {
  const license = await create()
  const first = await open(license)
  await settings({ limits: { ipPrefixPerMinute: 1, requestsPerActivationPerHour: 1, activationsPerLicensePerDay: 1 } })
  try {
    const count = async () => (await ctx.run('SELECT count(*) AS n FROM security_audit')).rows[0]!.n
    const before = Number(await count())
    const validate = (ip: string) => send('validate', build('validate', validateBody(first.ctr, first.device), first.device, { activation: first.activation, ip }))
    expect((await validate('198.51.1.2')).status).toBe(200)
    const sameNetwork = await validate('198.51.1.8')
    expect(sameNetwork).toMatchObject(error(429, 'rate_limited'))
    expect(sameNetwork.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(await validate('198.51.2.2')).toMatchObject(error(429, 'rate_limited'))
    expect((await send('activate', build('activate', activateBody(license.key, first.device), first.device, { ip: '198.51.3.2' }))).status).toBe(200)
    expect(await send('activate', build('activate', activateBody(license.key, first.device), first.device, { ip: '198.51.4.2' })))
      .toMatchObject(error(429, 'rate_limited'))
    expect(await count()).toBe(before + 2)
  } finally {
    await settings({ limits: { ipPrefixPerMinute: 1000, requestsPerActivationPerHour: 100, activationsPerLicensePerDay: 100 } })
  }
})

it('durably blocks abusive trusted prefixes and scans persisted security rows and failure logs for private data', async () => {
  const ip = '192.0.2.35'
  const unknown = 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB'
  const license = await create()
  const device = makeDevice()
  const log = vi.spyOn(ctx.payload.logger, 'error').mockImplementation(() => {})
  const call = (licenseKey: string, label: string) => send('activate', build('activate', {
    ...activateBody(licenseKey, device), deviceLabel: label,
  }, device, { ip }))
  await settings({ limits: { invalidLicensePerIpPerHour: 1 } })
  try {
    expect((await call(license.key, `Laptop ${device.fingerprint}`)).status).toBe(200)
    expect(await call(unknown, CUSTOMER.email)).toMatchObject(error(401, 'invalid_license'))
    expect(await call(unknown, ip)).toMatchObject(error(401, 'invalid_license'))
    expect(await call(license.key, license.key)).toMatchObject(error(403, 'blocked'))
    const run = vi.spyOn(ctx.payload.db.drizzle, 'all').mockRejectedValueOnce(new Error(`bind ${license.key} ${ip} ${device.fingerprint} ${CUSTOMER.email}`))
    const broken = await send('activate', build('activate', activateBody(license.key, device), device))
    expect(broken).toMatchObject(error(500, 'internal'))
    run.mockRestore()
    await flushLicensingObservations(ctx.payload)
    const tables = ['license_activations', 'security_events', 'security_audit', 'security_blocks', 'license_status_log']
    const rows = await Promise.all(tables.map((table) => ctx.run(`SELECT * FROM ${table}`)))
    const written = inspect([rows, log.mock.calls, broken.body], { depth: Infinity, maxArrayLength: Infinity })
    for (const secret of [license.key, unknown, device.fingerprint, ip, DEVICE_IP, CUSTOMER.email]) {
      expect(written.includes(secret)).toBe(false)
    }
    expect(written).toContain('192.0.2.0/24')
    expect(written).toContain(hashDeviceFingerprint(device.fingerprint))
  } finally { await settings({ limits: { invalidLicensePerIpPerHour: 10 } }) }
})

it('does not count key-owner rejections towards the invalid-license prefix block', async () => {
  const ip = '198.18.7.9'
  const license = await create()
  const { device } = await open(license, makeDevice(), { ip })
  // The same device key with a drifted fingerprint is still bound to the active row.
  const drifted = { ...device, fingerprint: randomToken(32) }
  await settings({ limits: { invalidLicensePerIpPerHour: 1 } })
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await send('activate', build('activate', activateBody(license.key, drifted), drifted, { ip })))
        .toMatchObject(error(401, 'invalid_license'))
    }
    expect((await ctx.run(`SELECT count(*) AS n FROM security_blocks WHERE value = '198.18.7.0/24'`)).rows).toEqual([{ n: 0 }])
    expect((await open(license, makeDevice(), { ip })).activation).toMatch(/^act_/)
  } finally { await settings({ limits: { invalidLicensePerIpPerHour: 10 } }) }
})

it('raises bad-signature severity per activation, never through the shared activate placeholder', async () => {
  const license = await create()
  const { activation, device } = await open(license)
  const severity = async (ip: string) => (await ctx.run(
    `SELECT severity FROM security_events WHERE type = 'api.bad_signature' AND ip_prefix = '${ip.replace(/\.\d+$/, '.0/24')}'`,
  )).rows.map((row) => row.severity)
  await settings({ limits: { badSignaturesPerActivationPerHour: 1 } })
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const forged = build('activate', activateBody(license.key, makeDevice()), makeDevice(), { ip: '198.18.8.9' })
      expect(await send('activate', forged)).toMatchObject(error(401, 'invalid_signature'))
      const wrongKey = build('validate', validateBody('A'.repeat(22), device), makeDevice(device.fingerprint), { activation, ip: '198.18.9.9' })
      expect(await send('validate', wrongKey)).toMatchObject(error(401, 'invalid_signature'))
    }
    await flushLicensingObservations(ctx.payload)
    expect(await severity('198.18.8.9')).toEqual(['medium'])
    expect(await severity('198.18.9.9')).toEqual(['high'])
  } finally { await settings({ limits: { badSignaturesPerActivationPerHour: 5 } }) }
})

it('verifies the real route exports and serves a 14-day default lease', async () => {
  const [{ POST: activate }, { POST: validate }, { POST: deactivate }] = await Promise.all([
    import('@/app/(payload)/api/v1/licensing/activate/route'),
    import('@/app/(payload)/api/v1/licensing/validate/route'),
    import('@/app/(payload)/api/v1/licensing/deactivate/route'),
  ])
  const license = await create()
  const device = makeDevice()
  const res = await activate(signedRequest('activate', activateBody(license.key, device), device).request)
  expect(res.status).toBe(200)
  const { lease, activationId: activation } = await res.json() as { lease: string; activationId: string }
  const { iat, exp, ctr } = leasePayload(lease)
  expect(exp - iat).toBe(14 * 86400)
  expect((await validate(signedRequest('validate', validateBody(ctr, device), device, { activation }).request)).status).toBe(200)
  expect((await deactivate(signedRequest('deactivate', {}, device, { activation }).request)).status).toBe(200)
})

it('isolates failed validation writes from concurrent refreshes and signs the transient error', async () => {
  const license = await create()
  const bad = await open(license)
  const good = await open(license)
  const nonce = randomToken()
  await ctx.run(`CREATE TRIGGER reject_test_refresh BEFORE UPDATE OF counter ON license_activations
    WHEN NEW.public_id = '${bad.activation.slice(4)}' BEGIN SELECT RAISE(ABORT, 'test refresh failure'); END`)
  const call = ({ device, activation, ctr }: typeof bad, n?: string) =>
    send('validate', build('validate', validateBody(ctr, device), device, { activation, nonce: n }))
  try {
    const [failed, succeeded] = await Promise.all([call(bad, nonce), call(good)])
    expect(failed).toMatchObject(error(500, 'internal'))
    expect(succeeded.status).toBe(200)
    expect((await ctx.run(`SELECT count(*) AS n FROM security_audit WHERE nonce = '${nonce}'`)).rows).toEqual([{ n: 0 }])
  } finally { await ctx.run('DROP TRIGGER reject_test_refresh') }
  expect((await call(bad, nonce)).status).toBe(200)
})

it('cannot refresh an activation after its license is assigned to another customer', async () => {
  const license = await create()
  const { device, activation, ctr } = await open(license)
  await ctx.payload.update({ collection: 'licenses', id: license.id, data: { customer: ctx.ids.otherCustomer } })
  expect(await send('validate', build('validate', validateBody(ctr, device), device, { activation })))
    .toMatchObject(error(401, 'invalid_signature'))
})

it('restricts the activation join to panel admins', async () => {
  const license = await create()
  await open(license)
  const request = (principal: 'admin' | 'customer' | 'apiKey') => ctx.rest('GET', `licenses/${license.id}?depth=1`, principal)
  expect((await request('admin')).json).toMatchObject({ activations: { totalDocs: 1 } })
  for (const principal of ['customer', 'apiKey'] as const) {
    const { status, json } = await request(principal)
    expect(status).toBe(200)
    expect(json).not.toHaveProperty('activations')
  }
})

it('uses the trusted address for CIDR blocks and ignores spoofed IP headers', async () => {
  const { createBlocksCache } = await import('@/lib/licensing/blocks-cache')
  await ctx.run(`INSERT INTO security_blocks (kind, value, scope, active, source) VALUES
    ('cidr', '2001:db8:9876::/48', 'all', 1, 'admin'),
    ('ip_prefix', '203.0.222.0/24', 'portal', 1, 'admin')`)
  const cache = createBlocksCache(ctx.payload)
  await cache.load()
  expect(cache.matches(now, { address: '2001:db8:9876::bee', prefix: '2001:db8:9876::/48' })).toBe(true)
  expect(cache.matches(now, { address: '2001:db8:9877::bee', prefix: '2001:db8:9877::/48' })).toBe(false)
  expect(cache.matches(now, { address: '203.0.222.73', prefix: '203.0.222.0/24' })).toBe(false)
  const { clientNetwork } = await import('@/lib/licensing/api/runtime')
  expect(clientNetwork(new Headers({ 'X-Softmarket-Client-IP': DEVICE_IP, 'X-Forwarded-For': DEVICE_IP }), now))
    .toMatchObject({ address: 'unknown', prefix: null, ip: null })
})

it('returns an unsigned 503 when the configured signing key cannot be loaded', async () => {
  const device = makeDevice()
  const license = await create()
  process.env.SOFTMARKET_LICENSE_SIGNING_KEY = 'invalid-test-key'
  try {
    const result = await send('activate', build('activate', activateBody(license.key, device), device), false)
    expect(result).toMatchObject(error(503, 'unavailable'))
    expect(result.headers.get('SM-Response-Signature')).toBeNull()
  } finally { process.env.SOFTMARKET_LICENSE_SIGNING_KEY = '' }
})

it('shares the prefix limit with the public keys endpoint and applies the global overload response', async () => {
  const { GET } = await import('@/app/(payload)/api/v1/licensing/keys/route')
  const ip = '198.51.99.73'
  const license = await create()
  const device = makeDevice()
  const post = (address: string) => send('activate', build('activate', activateBody(license.key, device), device, { ip: address }))
  await settings({ limits: { ipPrefixPerMinute: 1 } })
  try {
    const keys = await GET(new Request(`${ISSUER}/api/v1/licensing/keys`, { headers: {
      'X-Softmarket-Proxy-Secret': PROXY_SECRET, 'X-Softmarket-Client-IP': ip,
    } }))
    expect(keys.status).toBe(200)
    expect(await post(ip)).toMatchObject(error(429, 'rate_limited'))
    await settings({ limits: { globalPerSecond: 1 } })
    expect((await post('198.51.100.2')).status).toBe(200)
    expect(await post('198.51.101.2')).toMatchObject(error(503, 'unavailable'))
  } finally { await settings({ limits: { ipPrefixPerMinute: 1000, globalPerSecond: 10000 } }) }
})
