import { sql } from '@payloadcms/db-sqlite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { buildDeviceReleasedNotice } from '../../src/lib/email/licensing'
import { listPortalDevices, releasePortalDevice } from '../../src/lib/licensing/portal-devices'
import { deliverLicensingNotifications } from '../../src/lib/licensing/rules/notify'
import { normalizeSweepSettings } from '../../src/lib/licensing/rules/settings'
import { withPaymentTransaction } from '../../src/lib/payments/store/transaction'
import { getMyLicenseByPublicId } from '../../src/lib/portal/data'
import { createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { HOUR, ago, captureLog, insertActivation, resetLicensingRows, setSettings, stubMail } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('../../src/lib/site', () => ({ getPayloadClient: async () => ctx.payload }))

/*
 * L7a portal device release core on a temporary SQLite: ownership (foreign license/device = not_found, nothing
 * written), one conditional UPDATE + one portal event + one audit row, no license status row, quota from the
 * licensing settings, idempotent token, the customer e-mail through the L5 queue, no sensitive columns listed.
 */

let ctx: Ctx
let mail: ReturnType<typeof stubMail> | null = null
let licence: { id: number; publicId: string }
let otherLicence: { id: number; publicId: string }
const token = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
const pub = async (activation: number) => String((await ctx.run(`SELECT public_id FROM license_activations WHERE id = ${activation}`)).rows[0]!.public_id)
const count = async (table: string, where = '1=1') => Number((await ctx.run(`SELECT count(*) AS n FROM ${table} WHERE ${where}`)).rows[0]!.n)
const release = (activation: string, over: Partial<Parameters<typeof releasePortalDevice>[1]> = {}) =>
  releasePortalDevice(ctx.payload, { customerId: ctx.ids.customer, license: licence.publicId, activation, token: token(), ...over })

beforeAll(async () => { ctx = await setupLicensingDb('l7-devices') }, 240000)
afterAll(async () => { await ctx?.destroy() })
beforeEach(async () => {
  await resetLicensingRows(ctx)
  await ctx.run('DELETE FROM licenses')
  licence = await createLicense(ctx)
  otherLicence = await createLicense(ctx, ctx.ids.otherCustomer)
  await setSettings(ctx.payload, { selfService: { portalDeactivationsPer30Days: 3, rebindsPer30Days: 3 } })
})
afterEach(() => { mail?.restore(); mail = null })

describe('releasePortalDevice', () => {
  it('releases an own device: one UPDATE, one portal event, one audit row, no status row', async () => {
    const id = await insertActivation(ctx, licence.id, { lastSeenAt: ago(HOUR) })
    const before = await ctx.run(`SELECT status, status_changed_at FROM licenses WHERE id = ${licence.id}`)
    expect(await release(await pub(id))).toEqual({ ok: true, code: 'released' })
    expect((await ctx.run(`SELECT status, end_reason, ended_at FROM license_activations WHERE id = ${id}`)).rows[0]).toMatchObject({ status: 'deactivated', end_reason: 'customer_portal' })
    const events = (await ctx.run(`SELECT type, source, customer_id, license_id, notify_state, detail, ip_prefix FROM security_events`)).rows
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'activation.ended', source: 'portal', customer_id: ctx.ids.customer, notify_state: 'pending', ip_prefix: null })
    expect(JSON.parse(String(events[0]!.detail))).toMatchObject({ reason: 'customer_portal', notifyDeviceReleased: true })
    const audit = (await ctx.run(`SELECT action, actor_kind, reason, result, nonce, actor_user_id FROM security_audit`)).rows
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({ action: 'activation.deactivate', actor_kind: 'system', reason: 'customer_portal', result: 'ok', actor_user_id: null })
    expect(String(audit[0]!.nonce)).toMatch(/^portal:\d+:[0-9a-f]{32}$/)
    expect(await count('license_status_log')).toBe(0)
    expect((await ctx.run(`SELECT status, status_changed_at FROM licenses WHERE id = ${licence.id}`)).rows).toEqual(before.rows)
  })

  it('a foreign license or a foreign device is not_found and writes nothing', async () => {
    const own = await insertActivation(ctx, licence.id)
    const foreign = await insertActivation(ctx, otherLicence.id)
    // Foreign customer id against the own license.
    expect(await release(await pub(own), { customerId: ctx.ids.otherCustomer })).toEqual({ ok: false, code: 'not_found' })
    // Own license id with the other customer's device.
    expect(await release(await pub(foreign))).toEqual({ ok: false, code: 'not_found' })
    // The other customer's license public id with the other customer's device, as the wrong customer.
    expect(await release(await pub(foreign), { license: otherLicence.publicId })).toEqual({ ok: false, code: 'not_found' })
    // Malformed ids and tokens.
    expect(await release('nope')).toEqual({ ok: false, code: 'not_found' })
    expect(await release(await pub(own), { token: 'short' })).toEqual({ ok: false, code: 'not_found' })
    expect(await count('license_activations', `status = 'active'`)).toBe(2)
    expect(await count('security_events')).toBe(0)
    expect(await count('security_audit')).toBe(0)
  })

  it('looks up license details only for the current owner and returns a masked key', async () => {
    const doc = await ctx.payload.findByID({ collection: 'customers', id: ctx.ids.customer, depth: 0, overrideAccess: true })
    const customer = { ...doc, collection: 'customers' } as const
    const own = await getMyLicenseByPublicId(customer, 'en', licence.publicId)
    expect(own).toMatchObject({ publicId: licence.publicId, maskedKey: expect.stringContaining('•••••') })
    expect(own).not.toHaveProperty('key')
    expect(await getMyLicenseByPublicId(customer, 'en', otherLicence.publicId)).toBeNull()
    expect(await getMyLicenseByPublicId(customer, 'en', 'a'.repeat(24))).toBeNull()
    await ctx.run(`UPDATE licenses SET customer_id = ${ctx.ids.otherCustomer} WHERE id = ${licence.id}`)
    expect(await getMyLicenseByPublicId(customer, 'en', licence.publicId)).toBeNull()
  })

  it('an already ended device is not_active', async () => {
    const id = await insertActivation(ctx, licence.id, { status: 'deactivated', endReason: 'user', endedAt: ago(HOUR) })
    expect(await release(await pub(id))).toEqual({ ok: false, code: 'not_active' })
    expect(await count('security_events')).toBe(0)
  })

  it('enforces the 30 day quota per license and the 0 = off setting', async () => {
    await setSettings(ctx.payload, { selfService: { portalDeactivationsPer30Days: 2, rebindsPer30Days: 3 } })
    const ids = [await insertActivation(ctx, licence.id), await insertActivation(ctx, licence.id), await insertActivation(ctx, licence.id)]
    expect((await release(await pub(ids[0]!))).code).toBe('released')
    expect((await release(await pub(ids[1]!))).code).toBe('released')
    expect(await release(await pub(ids[2]!))).toEqual({ ok: false, code: 'limit' })
    expect((await ctx.run(`SELECT status FROM license_activations WHERE id = ${ids[2]}`)).rows[0]).toMatchObject({ status: 'active' })
    // A release older than 30 days no longer counts.
    await ctx.run(`UPDATE license_activations SET ended_at = '${ago(31 * 24 * HOUR)}' WHERE id = ${ids[0]}`)
    expect((await release(await pub(ids[2]!))).code).toBe('released')
    await setSettings(ctx.payload, { selfService: { portalDeactivationsPer30Days: 0, rebindsPer30Days: 3 } })
    const more = await insertActivation(ctx, licence.id)
    expect(await release(await pub(more))).toEqual({ ok: false, code: 'disabled' })
  })

  it('the same form token is idempotent', async () => {
    const id = await insertActivation(ctx, licence.id)
    const own = await pub(id)
    const t = token()
    const both = await Promise.all([release(own, { token: t }), release(own, { token: t })])
    expect(both.map(({ code }) => code).sort()).toEqual(['released', 'replayed'])
    const sameLicense = await insertActivation(ctx, licence.id)
    const foreign = await insertActivation(ctx, otherLicence.id)
    expect(await release(await pub(sameLicense), { token: t })).toEqual({ ok: false, code: 'not_found' })
    expect(await release(await pub(foreign), { token: t, license: otherLicence.publicId })).toEqual({ ok: false, code: 'not_found' })
    await ctx.run(`UPDATE licenses SET customer_id = ${ctx.ids.otherCustomer} WHERE id = ${licence.id}`)
    expect(await release(own, { token: t })).toEqual({ ok: false, code: 'not_found' })
    expect(await count('security_events')).toBe(1)
    expect(await count('security_audit')).toBe(1)
  })

  it('serializes releases for the final quota slot', async () => {
    await setSettings(ctx.payload, { selfService: { portalDeactivationsPer30Days: 1 } })
    const ids = await Promise.all([pub(await insertActivation(ctx, licence.id)), pub(await insertActivation(ctx, licence.id))])
    const outcomes = await Promise.all(ids.map((id) => release(id)))
    expect(outcomes.map(({ code }) => code).sort()).toEqual(['limit', 'released'])
    expect(await count('license_activations', `status = 'deactivated'`)).toBe(1)
    expect(await count('security_events')).toBe(1)
    expect(await count('security_audit')).toBe(1)
  })

  it('reads a newly committed quota after obtaining the writer lock', async () => {
    const device = await pub(await insertActivation(ctx, licence.id))
    let markLocked!: () => void
    let markReleaseWaiting!: () => void
    const locked = new Promise<void>((resolve) => { markLocked = resolve })
    const releaseWaiting = new Promise<void>((resolve) => { markReleaseWaiting = resolve })
    const settingsWrite = withPaymentTransaction(ctx.payload, async (tx) => {
      markLocked()
      await releaseWaiting
      await tx.run(sql`UPDATE licensing_settings SET self_service_portal_deactivations_per30_days = 0`)
    })
    await locked
    const begin = ctx.payload.db.beginTransaction.bind(ctx.payload.db)
    const spy = vi.spyOn(ctx.payload.db, 'beginTransaction').mockImplementationOnce((...args) => {
      markReleaseWaiting()
      return begin(...args)
    })
    try {
      expect(await release(device)).toEqual({ ok: false, code: 'disabled' })
      await settingsWrite
    } finally {
      markReleaseWaiting()
      spy.mockRestore()
    }
    expect(await count('security_events')).toBe(0)
  })

  it('rolls back the update and event if writing the receipt fails', async () => {
    const device = await pub(await insertActivation(ctx, licence.id))
    const requestToken = token()
    await ctx.run(`CREATE TRIGGER reject_portal_audit BEFORE INSERT ON security_audit BEGIN SELECT RAISE(ABORT, 'test rejection'); END`)
    try {
      await expect(release(device, { token: requestToken })).rejects.toThrow()
      expect(await count('license_activations', `status = 'active'`)).toBe(1)
      expect(await count('security_events')).toBe(0)
      expect(await count('security_audit')).toBe(0)
    } finally {
      await ctx.run('DROP TRIGGER reject_portal_audit')
    }
    expect((await release(device, { token: requestToken })).code).toBe('released')
  })

  it.each(['revoked', 'suspended', 'expired', 'past-expiry'] as const)('handles %s licenses without changing license state', async (status) => {
    const device = await pub(await insertActivation(ctx, licence.id))
    if (status === 'past-expiry') await ctx.run(`UPDATE licenses SET expires_at = '${ago(HOUR)}' WHERE id = ${licence.id}`)
    else await ctx.run(`UPDATE licenses SET status = '${status}' WHERE id = ${licence.id}`)
    expect((await release(device)).code).toBe(status === 'revoked' ? 'revoked' : 'released')
    expect((await ctx.run(`SELECT status FROM licenses WHERE id = ${licence.id}`)).rows[0]?.status).toBe(status === 'past-expiry' ? 'active' : status)
    expect(await count('license_status_log')).toBe(0)
    expect(await count('security_events')).toBe(status === 'revoked' ? 0 : 1)
  })

  it('lists only display columns of active devices of the own license', async () => {
    const device = await insertActivation(ctx, licence.id, { lastSeenAt: ago(HOUR), prefix: '203.0.113.0/24', ipHash: 'ip-hash-fixture', country: 'TR' })
    await ctx.run(`UPDATE license_activations SET device_label = 'owner@example.test' WHERE id = ${device}`)
    await insertActivation(ctx, licence.id, { status: 'deactivated', endReason: 'user' })
    await insertActivation(ctx, otherLicence.id)
    const summary = await listPortalDevices(ctx.payload, { licenseId: licence.id, customerId: ctx.ids.customer })
    expect(summary?.devices).toHaveLength(1)
    expect(summary).toMatchObject({ used: 1, max: 2, releaseLimit: 3, releasesLeft: 3 })
    expect(Object.keys(summary!.devices[0]!).sort()).toEqual(['activatedAt', 'country', 'id', 'label', 'lastSeenAt', 'platform'])
    expect(summary?.devices[0]?.label).toBeNull()
    expect(JSON.stringify(summary)).not.toMatch(/203\.0\.113|ip-hash-fixture|owner@example\.test/)
    expect(await listPortalDevices(ctx.payload, { licenseId: otherLicence.id, customerId: ctx.ids.customer })).toBeNull()
    await ctx.run(`UPDATE licenses SET customer_id = ${ctx.ids.otherCustomer} WHERE id = ${licence.id}`)
    expect(await listPortalDevices(ctx.payload, { licenseId: licence.id, customerId: ctx.ids.customer })).toBeNull()
    expect(await listPortalDevices(ctx.payload, { licenseId: licence.id, customerId: ctx.ids.otherCustomer })).toMatchObject({ devices: [], used: 0 })
  })
})

describe('device released e-mail (L5 queue)', () => {
  const settings = { ...normalizeSweepSettings({}), alertEmails: ['ops@example.test'] }
  const deliver = () => deliverLicensingNotifications(ctx.payload, settings, { now: () => new Date(), origin: 'https://site.test', log: captureLog().log })

  it('sends one masked-key notice to the owner, once, in the customer locale', async () => {
    mail = stubMail(ctx.payload)
    await ctx.run(`UPDATE customers SET preferred_locale = 'en' WHERE id = ${ctx.ids.customer}`)
    const id = await insertActivation(ctx, licence.id)
    await ctx.run(`UPDATE license_activations SET device_label = '<b>Office PC</b>' WHERE id = ${id}`)
    await release(await pub(id))
    const report = await deliver()
    expect(report.sent.customerDeviceReleased).toBe(1)
    const sent = mail.sent.filter((m) => String(m.to).includes('customer.l1'))
    expect(sent).toHaveLength(1)
    expect(sent[0]!.subject).toBe('A device was removed from your license')
    expect(sent[0]!.html).toContain('&lt;b&gt;Office PC&lt;/b&gt;')
    expect(sent[0]!.html).not.toContain('<b>Office PC</b>')
    const key = String((await ctx.run(`SELECT key FROM licenses WHERE id = ${licence.id}`)).rows[0]!.key)
    expect(sent[0]!.text).not.toContain(key)
    expect(sent[0]!.text).toContain('/en/account/licenses')
    await deliver()
    expect(mail.sent.filter((m) => String(m.to).includes('customer.l1'))).toHaveLength(1)
  })

  it('template escapes untrusted values and bounds the label', () => {
    const built = buildDeviceReleasedNotice({ to: 'a@b.test', locale: 'tr', product: '<i>P</i>', maskedKey: '•••-AB12C', deviceLabel: `"><script>x</script>${'a '.repeat(200)}end-of-label` }, 'https://site.test')
    expect(built.html).not.toContain('<script>')
    expect(built.html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(built.html).not.toContain('<i>P</i>')
    expect(built.subject).toBe('Lisansınızdan bir cihaz kaldırıldı')
    expect(built.html).not.toContain('end-of-label')
  })

  it.each(['someone@example.test', '203.0.113.0/24', 'a'.repeat(43), 'AB8CD-FGHJK-MNPQR-STVWX-Y2345'])(
    'suppresses sensitive-looking legacy device labels from both e-mail formats',
    (deviceLabel) => {
      const notice = buildDeviceReleasedNotice({ to: 'owner@example.test', locale: 'en', product: 'Product', maskedKey: '•••-Y2345', deviceLabel }, 'https://site.test')
      expect(notice.html).not.toContain(deviceLabel)
      expect(notice.text).not.toContain(deviceLabel)
    },
  )

  it.each(['license reassigned', 'activation mismatched'])('skips a release notice when the %s', async (scenario) => {
    mail = stubMail(ctx.payload)
    const device = await pub(await insertActivation(ctx, licence.id))
    await release(device)
    if (scenario === 'license reassigned') await ctx.run(`UPDATE licenses SET customer_id = ${ctx.ids.otherCustomer} WHERE id = ${licence.id}`)
    else {
      const foreign = await insertActivation(ctx, otherLicence.id, { status: 'deactivated', endReason: 'customer_portal' })
      await ctx.run(`UPDATE security_events SET activation_id = ${foreign} WHERE license_id = ${licence.id}`)
    }
    expect((await deliver()).sent.customerDeviceReleased).toBe(0)
    expect(mail.sent).toHaveLength(0)
    expect(await count('security_events', `json_extract(detail, '$.notifyCustomerDeviceReleasedAt') = 'skipped'`)).toBe(1)
  })

  it('defers without logging a recipient if SMTP disappears after the queue checks it', async () => {
    const sendEmail = ctx.payload.sendEmail
    mail = stubMail(ctx.payload)
    const device = await pub(await insertActivation(ctx, licence.id))
    await release(device)
    const log = vi.spyOn(ctx.payload.logger, 'info')
    ctx.payload.sendEmail = (message) => {
      delete process.env.SMTP_HOST
      delete process.env.SMTP_FROM
      return sendEmail(message)
    }
    try {
      const report = await deliver()
      expect(report).toMatchObject({ smtp: true, deferred: 1, sent: { customerDeviceReleased: 0 } })
      expect(await count('security_events', `notify_state = 'pending' AND notify_attempts = 0`)).toBe(1)
      expect(JSON.stringify(log.mock.calls)).not.toContain('customer.l1@example.test')
    } finally {
      log.mockRestore()
    }
  })
})
