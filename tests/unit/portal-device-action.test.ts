import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  origin: 'http://localhost:3100' as string | null,
  scheme: 'http',
  site: 'same-origin',
  customer: { id: 7 } as { id: number } | null,
  result: { ok: true, code: 'released' } as { ok: boolean; code: string },
  calls: [] as unknown[],
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'localhost:3100', 'x-forwarded-proto': state.scheme, 'sec-fetch-site': state.site,
    ...(state.origin ? { origin: state.origin } : {}) }),
}))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw Object.assign(new Error('NEXT_REDIRECT'), { url }) },
}))
vi.mock('@/lib/portal/session', () => ({ getCustomer: async () => state.customer }))
vi.mock('@/lib/site', () => ({ getPayloadClient: async () => ({}) }))
vi.mock('@/lib/licensing/portal-devices', () => ({
  releasePortalDevice: async (_p: unknown, input: unknown) => { state.calls.push(input); return state.result },
}))

import { releaseDeviceAction } from '@/lib/portal/device-actions'

const LIC = 'a'.repeat(24)
const DEV = 'b'.repeat(24)
const form = (over: Record<string, string> = {}) => {
  const data = new FormData()
  for (const [k, v] of Object.entries({ locale: 'en', license: LIC, device: DEV, token: 'c'.repeat(32), ...over })) data.set(k, v)
  return data
}
const target = async (data: FormData) => {
  try { await releaseDeviceAction(data) } catch (e) { return (e as { url?: string }).url }
  return undefined
}

beforeEach(() => {
  state.origin = 'http://localhost:3100'
  state.scheme = 'http'
  state.site = 'same-origin'
  state.customer = { id: 7 }
  state.result = { ok: true, code: 'released' }
  state.calls = []
})

describe('releaseDeviceAction (no-JS POST -> 303)', () => {
  it('redirects to the license page with a notice and passes only the session customer', async () => {
    expect(await target(form())).toBe(`/en/account/licenses/${LIC}?cihaz=released`)
    expect(state.calls).toEqual([{ customerId: 7, license: LIC, activation: DEV, token: 'c'.repeat(32) }])
  })
  it.each([
    ['cross-origin', 'http://other.test', 'cross-site'],
    ['originless', null, 'same-origin'],
    ['different scheme', 'https://localhost:3100', 'same-origin'],
    ['noncanonical origin', 'http://localhost:3100/path', 'same-origin'],
    ['same-site metadata', 'http://localhost:3100', 'same-site'],
  ])('refuses a %s request without touching the core', async (_kind, origin, site) => {
    state.origin = origin
    state.site = site
    expect(await target(form())).toBe('/en/account/licenses?cihaz=error')
    expect(state.calls).toHaveLength(0)
  })
  it('accepts the origin of an HTTPS request behind the proxy', async () => {
    state.origin = 'https://localhost:3100'
    state.scheme = 'https'
    expect(await target(form())).toBe(`/en/account/licenses/${LIC}?cihaz=released`)
  })
  it('refuses malformed action arguments without touching the core', async () => {
    expect(await target(undefined as unknown as FormData)).toBe('/tr/hesap/lisanslar?cihaz=error')
    expect(state.calls).toHaveLength(0)
  })
  it('sends anonymous visitors to the login page', async () => {
    state.customer = null
    expect(await target(form({ locale: 'tr' }))).toContain('/tr/hesap/giris')
    expect(state.calls).toHaveLength(0)
  })
  it('a foreign license never redirects back to its own page', async () => {
    state.result = { ok: false, code: 'not_found' }
    expect(await target(form())).toBe('/en/account/licenses?cihaz=error')
  })
  it('maps limit and replay outcomes', async () => {
    state.result = { ok: false, code: 'limit' }
    expect(await target(form({ locale: 'tr' }))).toBe(`/tr/hesap/lisanslar/${LIC}?cihaz=limit`)
    state.result = { ok: true, code: 'replayed' }
    expect(await target(form())).toContain('cihaz=released')
  })
  it('rate limits concurrent requests per customer without redirecting to unchecked ids', async () => {
    state.customer = { id: 99 }
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => target(form())))
    expect(outcomes.filter((url) => url === '/en/account/licenses?cihaz=rate')).toHaveLength(2)
    expect(state.calls).toHaveLength(10)
    state.customer = { id: 100 }
    expect(await target(form())).toBe(`/en/account/licenses/${LIC}?cihaz=released`)
  })
})

describe('portal device page and i18n', () => {
  const flat = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, `${p}${k}.`)) : [p.slice(0, -1)]
  const load = (l: string) => JSON.parse(readFileSync(join(process.cwd(), `src/i18n/messages/${l}.json`), 'utf8')).portal
  it('TR and EN have the same device and license keys', () => {
    const tr = load('tr'), en = load('en')
    expect(flat(tr.devices).sort()).toEqual(flat(en.devices).sort())
    expect(flat(tr.devices).length).toBeGreaterThan(30)
    expect(tr.licenses.manageDevices).toBeTruthy()
    expect(en.licenses.manageDevices).toBeTruthy()
    for (const l of [tr, en]) for (const v of flat(l.devices)) expect(v).toBeTruthy()
  })
  it('the page and the listing never reference sensitive columns', () => {
    const files = ['src/app/(frontend)/[locale]/hesap/(portal)/lisanslar/[id]/page.tsx', 'src/lib/licensing/portal-devices.ts']
    for (const f of files) {
      const src = readFileSync(join(process.cwd(), f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(src).not.toMatch(/fingerprint|device_public_key|device_key_thumbprint|last_ip|ip_hash|devicePublicKey/i)
    }
  })
})
