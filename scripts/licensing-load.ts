// In-process by default. With --http, start an existing isolated .next-l3 production build on loopback port 3600.
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'

import { createLicensingPost, flushLicensingObservations } from '@/lib/licensing/api/route'
import type { Endpoint } from '@/lib/licensing/api/guard'
import { provisionSigningKey } from '@/lib/licensing/signing'
import type { License } from '@/payload-types'
import {
  activateBody, enableLicensingFixture, leasePayload, makeDevice, PROXY_SECRET, randomToken,
  signedRequest, validateBody, type TestDevice,
} from '../tests/unit/helpers/licensing-client'
import { setupLicensingDb } from '../tests/unit/helpers/licensing-db'

const useHttp = process.argv.includes('--http')
const origin = 'http://127.0.0.1:3600'
const prefix = '/api/v1/licensing'
const assert = (condition: boolean, code: string) => {
  if (!condition) throw new Error(code)
}
let server: ChildProcess | undefined
let exited: Promise<unknown> | undefined

async function launch(expectedKid: string) {
  server = spawn(resolve('node_modules/.bin/next'), [
    // The pnpm shim preserves the NODE_PATH that externalised packages such as libsql need.
    'start', '-H', '127.0.0.1', '-p', '3600',
  ], { env: { ...process.env, NEXT_DIST_DIR: '.next-l3' }, stdio: 'ignore' })
  exited = once(server, 'exit').catch(() => undefined)
  for (let wait = 0; wait < 100; wait++) {
    if (server.exitCode !== null) throw new Error('isolated_http_server_exited')
    try {
      const response = await fetch(`${origin}${prefix}/keys`, { headers: { 'X-Softmarket-Proxy-Secret': PROXY_SECRET, 'X-Softmarket-Client-IP': '203.0.113.200' }, signal: AbortSignal.timeout(1000) })
      if (response.ok && (await response.json() as { keys: { kid: string }[] }).keys.some(({ kid }) => kid === expectedKid)) return
    } catch { /* Wait for the isolated server to start. */ }
    await setTimeout(100)
  }
  throw new Error('isolated_http_server_not_ready')
}

type Device = { activationId: string; device: TestDevice; ctr: string }
type Reply = { activationId: string; lease: string; error?: { code: string } }
const percentiles = (latencies: number[]) => {
  const sorted = latencies.sort((a, b) => a - b)
  const percentile = (p: number) => Number(sorted[Math.ceil(sorted.length * p) - 1]!.toFixed(1))
  return { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) }
}

async function main() {
  process.env.FORM_PROXY_SECRET = PROXY_SECRET
  process.env.SOFTMARKET_SECRETS_KEY = randomToken(32)
  process.env.SOFTMARKET_LICENSE_SIGNING_KEY = ''
  const ctx = await setupLicensingDb('l3-load')
  const { payload, ids } = ctx
  try {
    await enableLicensingFixture(payload, ids.product)
    await payload.updateGlobal({ slug: 'licensing-settings', data: {
      limits: { ipPrefixPerMinute: 60, requestsPerActivationPerHour: 10_000, globalPerSecond: 10_000 },
    } })
    const { kid } = await provisionSigningKey(payload)
    const newLicense = (maxDevices: number) => payload.create({
      collection: 'licenses', depth: 0,
      data: { key: '', status: 'active', startsAt: new Date().toISOString(), customer: ids.customer, edition: ids.edition, maxDevices },
      context: { paymentsOrderFulfilment: true },
    })
    const [first, second] = [await newLicense(100), await newLicense(3)]
    const handlers = {
      activate: createLicensingPost('activate', { loadPayload: async () => payload }),
      validate: createLicensingPost('validate', { loadPayload: async () => payload }),
      deactivate: createLicensingPost('deactivate', { loadPayload: async () => payload }),
    }
    if (useHttp) await launch(kid)
    const run = (endpoint: Endpoint, body: object, device: TestDevice, ip: string, activation?: string) => {
      const { request } = signedRequest(endpoint, body, device, { activation, ip, origin })
      return useHttp ? fetch(request) : handlers[endpoint](request)
    }
    const activate = (license: License, device: TestDevice, ip: string) => run('activate', activateBody(license.key, device), device, ip)
    const devices: Device[] = await Promise.all(Array.from({ length: 100 }, async (_, i) => {
      const device = makeDevice()
      const response = await activate(first, device, `198.20.${i}.2`)
      assert(response.status === 200, 'activation_setup_failed')
      const { activationId, lease } = await response.json() as Reply
      return { activationId, device, ctr: leasePayload(lease).ctr }
    }))

    const latencies: number[] = []
    let validateErrors = 0
    for (let round = 0; round < 10; round++) {
      await Promise.all(devices.map(async (binding, i) => {
        const start = performance.now()
        const response = await run('validate', validateBody(binding.ctr, binding.device), binding.device, `198.20.${i}.2`, binding.activationId)
        const body = await response.json() as Reply
        latencies.push(performance.now() - start)
        if (response.status === 200) binding.ctr = leasePayload(body.lease).ctr
        else validateErrors++
      }))
    }
    console.log(JSON.stringify({ transport: useHttp ? 'http' : 'in-process', validate: 1000, validateErrors, milliseconds: percentiles(latencies) }))

    const count = async (table: 'security_audit' | 'security_events') =>
      Number((await ctx.run(`SELECT count(*) AS n FROM ${table}`)).rows[0]!.n)
    if (useHttp) await setTimeout(10_500)
    else await flushLicensingObservations(payload)
    const auditBefore = await count('security_audit')
    const eventsBefore = await count('security_events')
    const statuses: Record<number, number> = {}
    const start = performance.now()
    for (let batch = 0; batch < 10; batch++) {
      const results = await Promise.all(devices.map(({ ctr, device, activationId }) =>
        run('validate', validateBody(ctr, device), device, '198.51.100.73', activationId)))
      for (const [index, response] of results.entries()) {
        statuses[response.status] = (statuses[response.status] ?? 0) + 1
        if (response.status === 200) devices[index]!.ctr = leasePayload((await response.json() as Reply).lease).ctr
        else await response.body?.cancel()
      }
      await setTimeout(Math.max(0, start + (batch + 1) * 1000 - performance.now()))
    }
    if (useHttp) await setTimeout(10_500)
    else await flushLicensingObservations(payload)
    const auditDelta = (await count('security_audit')) - auditBefore
    const prefixEvents = (await ctx.run(`SELECT count, severity FROM security_events
      WHERE type = 'api.rate_limited' AND ip_prefix = '198.51.100.0/24'`)).rows
    console.log(JSON.stringify({
      singlePrefix: 1000, statuses, auditDelta, eventDelta: (await count('security_events')) - eventsBefore, prefixEvents,
    }))

    const admin = useHttp ? fetch(`${origin}/api/licenses/${second.id}`, {
      method: 'PATCH', headers: { ...ctx.headers.admin, origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Concurrent staff update.' }),
    }).then(async (response) => response.ok && (await response.json() as { doc: License }).doc.notes === 'Concurrent staff update.')
      : payload.update({ collection: 'licenses', id: second.id, data: { notes: 'Concurrent staff update.' } })
        .then(({ notes }) => notes === 'Concurrent staff update.')
    const [staffSaved, ...responses] = await Promise.all([
      admin,
      ...Array.from({ length: 50 }, (_, i) => activate(second, makeDevice(), `198.19.${i}.2`)),
    ])
    const seats = responses.filter(({ status }) => status === 200).length
    const seatLimited = responses.filter(({ status }) => status === 409).length
    console.log(JSON.stringify({ parallelActivations: 50, seats, seatLimited, staffSaved }))
    assert(validateErrors === 0 && statuses[429]! > 0 && auditDelta === statuses[200]
      && Object.keys(statuses).every((status) => status === '200' || status === '429')
      && prefixEvents.reduce((sum, event) => sum + Number(event.count), 0) === statuses[429]
      && staffSaved && seats === 3 && seatLimited === 47, 'load_correctness_failed')
  } finally {
    if (server && server.exitCode === null) {
      server.kill('SIGTERM')
      await exited
    }
    await flushLicensingObservations(payload)
    await ctx.destroy()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'licensing_load_failed')
  process.exitCode = 1
})
