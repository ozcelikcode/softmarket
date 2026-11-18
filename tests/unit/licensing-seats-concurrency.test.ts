import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import { createLicensingPost, flushLicensingObservations } from '@/lib/licensing/api/route'
import { provisionSigningKey } from '@/lib/licensing/signing'
import type { License } from '@/payload-types'
import { activateBody, enableLicensingFixture, makeDevice, PROXY_SECRET, randomToken, signedRequest } from './helpers/licensing-client'
import { setupLicensingDb, type Ctx } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
let ctx: Ctx
const activate = createLicensingPost('activate', { loadPayload: async () => ctx.payload })
const license = async (maxDevices: number) => ctx.payload.create({
  collection: 'licenses', depth: 0, data: { customer: ctx.ids.customer, edition: ctx.ids.edition, maxDevices, startsAt: new Date().toISOString(), key: '', status: 'active' },
  context: { paymentsOrderFulfilment: true },
})
const request = (license: License, device = makeDevice()) => signedRequest('activate', activateBody(license.key, device), device).request

beforeAll(async () => {
  vi.stubEnv('FORM_PROXY_SECRET', PROXY_SECRET)
  vi.stubEnv('SOFTMARKET_SECRETS_KEY', randomToken(32))
  vi.stubEnv('SOFTMARKET_LICENSE_SIGNING_KEY', '')
  ctx = await setupLicensingDb('l3-concurrency')
  await enableLicensingFixture(ctx.payload, ctx.ids.product)
  await provisionSigningKey(ctx.payload)
}, 240_000)

afterAll(async () => {
  if (ctx) await flushLicensingObservations(ctx.payload)
  await ctx?.destroy()
  vi.unstubAllEnvs()
})

it.each([20, 50])('awards exactly three seats to %i simultaneous devices alongside a staff write', async (attempts) => {
  const row = await license(3)
  const [admin, ...responses] = await Promise.all([
    ctx.payload.update({ collection: 'licenses', id: row.id, data: { notes: 'Staff update during activation.' } }),
    ...Array.from({ length: attempts }, () => activate(request(row))),
  ])
  expect(admin.notes).toBe('Staff update during activation.')
  const successes = responses.filter((response) => response.status === 200)
  const failures = responses.filter((response) => response.status === 409)
  expect(successes).toHaveLength(3)
  expect(failures).toHaveLength(attempts - 3)
  for (const response of failures) {
    expect(await response.json()).toMatchObject({ error: { code: 'seat_limit' }, used: 3, max: 3 })
  }
  expect((await ctx.run(`SELECT COUNT(*) AS n FROM license_activations WHERE license_id = ${row.id} AND status = 'active'`)).rows)
    .toEqual([{ n: 3 }])
})

it('keeps simultaneous retries idempotent and enforces the global active public-key uniqueness', async () => {
  const row = await license(1)
  const device = makeDevice()
  const results = await Promise.all(Array.from({ length: 5 }, () => activate(request(row, device))))
  expect(results.map((result) => result.status)).toEqual([200, 200, 200, 200, 200])
  const bodies = await Promise.all(results.map((result) => result.json() as Promise<{ activationId: string }>))
  expect(new Set(bodies.map((body) => body.activationId)).size).toBe(1)
  const other = await license(1)
  const repeatedKey = await activate(request(other, device))
  expect(repeatedKey.status).toBe(401)
  expect(await repeatedKey.json()).toMatchObject({ error: { code: 'invalid_license' } })
  expect((await ctx.run(`SELECT count(*) AS n FROM license_activations WHERE license_id = ${other.id}`)).rows)
    .toEqual([{ n: 0 }])
})

it('rolls back the nonce receipt when the active-seat insert fails and permits a safe retry', async () => {
  const row = await license(1)
  const device = makeDevice()
  const nonce = randomToken()
  const signed = () => signedRequest('activate', activateBody(row.key, device), device, { nonce }).request
  await ctx.run(`CREATE TRIGGER reject_test_activation BEFORE INSERT ON license_activations
    WHEN NEW.license_id = ${row.id} BEGIN SELECT RAISE(ABORT, 'test activation failure'); END`)
  try {
    expect((await activate(signed())).status).toBe(500)
    expect((await ctx.run(`SELECT COUNT(*) AS n FROM security_audit WHERE nonce = '${nonce}'`)).rows).toEqual([{ n: 0 }])
  } finally { await ctx.run('DROP TRIGGER reject_test_activation') }
  expect((await activate(signed())).status).toBe(200)
  expect((await activate(signed())).status).toBe(401)
})
