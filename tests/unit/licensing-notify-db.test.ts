import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { SMTP_UNAVAILABLE, type SmtpOnlyEmail } from '../../src/lib/email/adapter'
import { NOTIFY_POLICY, deliverLicensingNotifications, enqueueDigest, enqueueSeverityAlerts, istanbulHour } from '../../src/lib/licensing/rules/notify'
import { normalizeSweepSettings, type SweepSettings } from '../../src/lib/licensing/rules/settings'
import { CUSTOMER, createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { HOUR, ago, captureLog, insertEvent, resetLicensingRows, stubMail } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * L5 durable notification queue on `security-events` (temporary SQLite, stubbed SMTP): no SMTP = nothing claimed or
 * counted, lease against concurrent senders, backoff and attempt budget, at-least-once with markers, recipient
 * fallbacks, customer TR/EN messages, severity enqueue, digest, max age.
 */

let ctx: Ctx
let mail: ReturnType<typeof stubMail> | null = null
const settings: SweepSettings = { ...normalizeSweepSettings({}), alertEmails: ['ops@example.test'] }
const row = async (id: number) => (await ctx.run(
  `SELECT notify_state AS state, notify_attempts AS attempts, notify_next_at AS next, notify_last_error AS error, detail FROM security_events WHERE id = ${id}`,
)).rows[0]!
const deliver = (options: { now?: () => Date; settings?: SweepSettings; env?: Record<string, string | undefined> } = {}) =>
  deliverLicensingNotifications(ctx.payload, options.settings ?? settings, { now: options.now ?? (() => new Date()), origin: 'https://site.test', log: captureLog().log, env: options.env })

/** A rule event that wants an admin alert (and, when suspended, a customer e-mail). */
async function queued(license: number | null = null, action = 'notified') {
  const id = await insertEvent(ctx, { type: 'license.ip_spread', source: 'rule', license, severity: 'medium', notifyState: 'pending' })
  await ctx.run(`UPDATE security_events SET action_taken = '${action}', customer_id = ${license ? ctx.ids.customer : 'NULL'},
    detail = '${JSON.stringify({ notifyAdminWant: action, outcome: action })}' WHERE id = ${id}`)
  return id
}

beforeAll(async () => { ctx = await setupLicensingDb('l5-notify') }, 240000)
afterAll(async () => { await ctx?.destroy() })
beforeEach(async () => { await resetLicensingRows(ctx) })
afterEach(() => { mail?.restore(); mail = null; delete process.env.PAYMENTS_ALERT_EMAIL })

describe('licensing notification queue', () => {
  it('without SMTP nothing is claimed or counted; rows stay pending', async () => {
    const id = await queued()
    const report = await deliver()
    expect(report).toMatchObject({ smtp: false, claimed: 0, failed: 0 })
    expect(await row(id)).toMatchObject({ state: 'pending', attempts: 0, next: null })
  })

  it('sends one admin alert for all due rows, marks them, and never resends', async () => {
    mail = stubMail(ctx.payload)
    const a = await queued()
    const b = await queued()
    const report = await deliver()
    expect(report).toMatchObject({ smtp: true, claimed: 2, sent: { admin: 2 }, failed: 0 })
    expect(mail.sent).toHaveLength(1)
    expect(mail.sent[0]!.to).toEqual(['ops@example.test'])
    expect(mail.sent[0]!.text).toContain(`#${a}`)
    expect(mail.sent[0]!.text).toContain(`#${b}`)
    for (const id of [a, b]) {
      const r = await row(id)
      expect(r).toMatchObject({ state: 'sent', next: null })
      expect(JSON.parse(String(r.detail))).toMatchObject({ notifyAdminDone: 'notified' })
    }
    expect((await deliver()).claimed).toBe(0)
    expect(mail.sent).toHaveLength(1)
  })

  it('keeps admin alerts and digests pending if SMTP disappears after the queue check', async () => {
    mail = stubMail(ctx.payload)
    const alert = await queued()
    const digest = await insertEvent(ctx, { type: 'system.daily_digest', source: 'system', notifyState: 'pending' })
    const transport = vi.spyOn(ctx.payload, 'sendEmail').mockResolvedValue(SMTP_UNAVAILABLE)
    try {
      expect(await deliver()).toMatchObject({ claimed: 2, deferred: 2, failed: 0, sent: { admin: 0, digest: 0 } })
      expect(transport).toHaveBeenCalledTimes(2)
      for (const [message] of transport.mock.calls) expect(message).toMatchObject({ requireSmtp: true })
      for (const id of [alert, digest]) expect(await row(id)).toMatchObject({ state: 'pending', attempts: 0 })
    } finally { transport.mockRestore() }
  })

  it('concurrent senders: the lease lets exactly one of them send', async () => {
    mail = stubMail(ctx.payload)
    for (let i = 0; i < 5; i++) await queued()
    const [x, y] = await Promise.all([deliver(), deliver()])
    expect(x.claimed + y.claimed).toBe(5)
    expect(mail.sent).toHaveLength(1)
  })

  it('transport errors back off exponentially and stop after the attempt budget', async () => {
    mail = stubMail(ctx.payload)
    mail.failWhen(() => true)
    const id = await queued()
    let now = Date.now()
    const { lines, log } = captureLog()
    for (let attempt = 1; attempt <= NOTIFY_POLICY.maxAttempts; attempt++) {
      const report = await deliverLicensingNotifications(ctx.payload, settings, { now: () => new Date(now), origin: 'https://site.test', log })
      expect(report).toMatchObject({ claimed: 1, failed: 1 })
      const r = await row(id)
      expect(r).toMatchObject({ attempts: attempt, error: 'smtp_error', state: attempt === NOTIFY_POLICY.maxAttempts ? 'failed' : 'pending' })
      expect(Date.parse(String(r.next)) - now).toBe(NOTIFY_POLICY.backoffMs * 2 ** (attempt - 1))
      // Not due yet: nothing is claimed.
      expect((await deliverLicensingNotifications(ctx.payload, settings, { now: () => new Date(now + 60_000), origin: 'https://site.test', log })).claimed).toBe(0)
      now = Date.parse(String(r.next)) + 1
    }
    expect((await deliverLicensingNotifications(ctx.payload, settings, { now: () => new Date(now), origin: 'https://site.test', log })).claimed).toBe(0)
    // The transport error text (which may contain addresses) is never logged.
    expect(lines.join('\n')).not.toMatch(/10\.1\.2\.3|@example\.test/)
  })

  it('at least once: an expired lease without markers is delivered again; markers prevent duplicates', async () => {
    mail = stubMail(ctx.payload)
    const lost = await queued()
    const done = await queued()
    // Both were claimed by a sender that died; only `done` had written its marker before the crash.
    await ctx.run(`UPDATE security_events SET notify_next_at = '${ago(60_000)}'`)
    await ctx.run(`UPDATE security_events SET detail = json_set(detail, '$.notifyAdminDone', 'notified') WHERE id = ${done}`)
    const report = await deliver()
    expect(report).toMatchObject({ claimed: 2, sent: { admin: 1 } })
    expect(mail.sent[0]!.text).toContain(`#${lost}`)
    expect(mail.sent[0]!.text).not.toContain(`#${done}`)
    expect(await row(done)).toMatchObject({ state: 'sent' })
  })

  it('a lease that is still held is not claimed again', async () => {
    mail = stubMail(ctx.payload)
    const id = await queued()
    await ctx.run(`UPDATE security_events SET notify_next_at = '${new Date(Date.now() + 60_000).toISOString()}' WHERE id = ${id}`)
    expect((await deliver()).claimed).toBe(0)
  })

  it('recipients: PAYMENTS_ALERT_EMAIL, then site contact; none = deferred without counting an attempt', async () => {
    mail = stubMail(ctx.payload)
    const noRecipients = { ...settings, alertEmails: [] }
    const a = await queued()
    expect(await deliver({ settings: noRecipients })).toMatchObject({ claimed: 1, deferred: 1, failed: 0 })
    expect(await row(a)).toMatchObject({ state: 'pending', attempts: 0 })
    expect(mail.sent).toHaveLength(0)
    process.env.PAYMENTS_ALERT_EMAIL = 'payments@example.test'
    expect(await deliver({ settings: noRecipients, now: () => new Date(Date.now() + 16 * 60_000) })).toMatchObject({ sent: { admin: 1 } })
    expect(mail.sent[0]!.to).toEqual(['payments@example.test'])
    delete process.env.PAYMENTS_ALERT_EMAIL
    await ctx.payload.updateGlobal({ slug: 'site-settings', data: { contact: { email: 'contact@example.test' } } as never })
    await queued()
    await deliver({ settings: noRecipients })
    expect(mail.sent[1]!.to).toEqual(['contact@example.test'])
    await ctx.payload.updateGlobal({ slug: 'site-settings', data: { contact: { email: null } } as never })
  })

  it('customer suspension and restore e-mails: TR/EN by preference, masked key only, restore only after a suspension e-mail', async () => {
    mail = stubMail(ctx.payload)
    const { id: license } = await createLicense(ctx)
    const key = String((await ctx.run(`SELECT key FROM licenses WHERE id = ${license}`)).rows[0]!.key)
    const event = await queued(license, 'suspended')
    await deliver()
    const toCustomer = mail.sent.filter((m) => JSON.stringify(m.to).includes(CUSTOMER.email))
    expect(toCustomer).toHaveLength(1)
    expect(toCustomer[0]!.subject).toBe('Lisansınız geçici olarak askıya alındı')
    expect(toCustomer[0]!.text).toContain(key.slice(-5))
    expect(toCustomer[0]!.text).not.toContain(key)
    const admin = mail.sent.find((m) => !JSON.stringify(m.to).includes(CUSTOMER.email))!
    expect(admin.text).not.toContain(CUSTOMER.email)
    expect(JSON.parse(String((await row(event)).detail)).notifyCustomerSuspendedAt).toBeTruthy()

    await ctx.run(`UPDATE customers SET preferred_locale = 'en' WHERE id = ${ctx.ids.customer}`)
    await ctx.run(`UPDATE security_events SET notify_state = 'pending', detail = json_set(detail, '$.restoredAt', '${new Date().toISOString()}') WHERE id = ${event}`)
    await deliver()
    expect(mail.sent.at(-1)!.subject).toBe('Your license has been re-enabled')
    expect((await deliver()).claimed).toBe(0)
    expect(mail.sent.filter((m) => JSON.stringify(m.to).includes(CUSTOMER.email))).toHaveLength(2)
    await ctx.run(`UPDATE customers SET preferred_locale = 'tr' WHERE id = ${ctx.ids.customer}`)

    // Customer e-mail switched off: only the admin alert.
    const quiet = await queued(license, 'suspended')
    const before = mail.sent.length
    await deliver({ settings: { ...settings, customerSuspensionEmail: false } })
    expect(mail.sent.length - before).toBe(1)
    expect(await row(quiet)).toMatchObject({ state: 'sent' })
  })

  it.each(['suspended', 'restored'] as const)('defers the customer %s notice if SMTP disappears after claiming the row', async (kind) => {
    mail = stubMail(ctx.payload)
    const { id: license } = await createLicense(ctx)
    const event = await queued(license, 'suspended')
    if (kind === 'restored') {
      const now = new Date().toISOString()
      await ctx.run(`UPDATE security_events SET detail = json_set(detail, '$.notifyCustomerSuspendedAt', '${now}', '$.restoredAt', '${now}') WHERE id = ${event}`)
    }
    const send = ctx.payload.sendEmail
    const transport = vi.spyOn(ctx.payload, 'sendEmail').mockImplementation(async (message) => {
      if (message.to !== CUSTOMER.email) return send(message)
      expect((message as SmtpOnlyEmail).requireSmtp).toBe(true)
      return SMTP_UNAVAILABLE
    })
    try {
      expect(await deliver()).toMatchObject({ claimed: 1, failed: 0, sent: { customerSuspended: 0, customerRestored: 0 } })
      expect(transport).toHaveBeenCalledWith(expect.objectContaining({ to: CUSTOMER.email, requireSmtp: true }))
      expect(await row(event)).toMatchObject({ state: 'pending', attempts: 0, error: null })
    } finally {
      transport.mockRestore()
    }
  })

  it('queues API events at or above minSeverityImmediate once, within 24 h', async () => {
    const high = await insertEvent(ctx, { type: 'api.replay', severity: 'high' })
    const low = await insertEvent(ctx, { type: 'api.invalid_license', severity: 'low' })
    const old = await insertEvent(ctx, { type: 'api.replay', severity: 'critical', lastSeenAt: ago(25 * HOUR) })
    const triaged = await insertEvent(ctx, { type: 'api.replay', severity: 'high', triage: 'resolved' })
    expect(await enqueueSeverityAlerts(ctx.payload, settings, new Date())).toBe(1)
    expect(await enqueueSeverityAlerts(ctx.payload, settings, new Date())).toBe(0)
    expect(await row(high)).toMatchObject({ state: 'pending' })
    expect(JSON.parse(String((await row(high)).detail))).toEqual({ notifyAdminWant: 'high' })
    for (const id of [low, old, triaged]) expect((await row(id)).state).toBeNull()
    expect(await enqueueSeverityAlerts(ctx.payload, { ...settings, minSeverityImmediate: 'low' }, new Date())).toBe(1)
  })

  it('daily digest: one row per local day at the configured hour, counts only', async () => {
    mail = stubMail(ctx.payload)
    const now = new Date()
    const on = { ...settings, dailyDigest: true, digestHour: istanbulHour(now) }
    expect(await enqueueDigest(ctx.payload, { ...on, digestHour: (on.digestHour + 1) % 24 }, now)).toBe(false)
    expect(await enqueueDigest(ctx.payload, { ...settings, digestHour: on.digestHour }, now)).toBe(false)
    expect(await enqueueDigest(ctx.payload, on, now)).toBe(true)
    expect(await enqueueDigest(ctx.payload, on, now)).toBe(false)
    await insertEvent(ctx, { type: 'api.replay', severity: 'high' })
    const report = await deliver({ settings: on })
    expect(report.sent.digest).toBe(1)
    expect(mail.sent[0]!.subject).toMatch(/daily digest/)
    expect(mail.sent[0]!.text).toMatch(/high: 1/)
    expect((await deliver({ settings: on })).sent.digest).toBe(0)
  })

  it('pending rows untouched for 7 days are skipped', async () => {
    const id = await queued()
    await ctx.run(`UPDATE security_events SET updated_at = '${ago(8 * 24 * HOUR)}' WHERE id = ${id}`)
    expect((await deliver()).expired).toBe(1)
    expect(await row(id)).toMatchObject({ state: 'skipped' })
  })

  it('invalid minSeverityImmediate fails safe to high; CHANGE_ site contact is rejected; blank customer email skips', async () => {
    mail = stubMail(ctx.payload)
    const info = await insertEvent(ctx, { type: 'api.clock_skew', severity: 'info' })
    const high = await insertEvent(ctx, { type: 'api.replay', severity: 'high' })
    expect(await enqueueSeverityAlerts(ctx.payload, { ...settings, minSeverityImmediate: 'invalid' as never }, new Date())).toBe(1)
    expect((await row(info)).state).toBeNull()
    expect(await row(high)).toMatchObject({ state: 'pending' })

    await ctx.payload.updateGlobal({ slug: 'site-settings', data: { contact: { email: 'CHANGE_ME@example.test' } } as never })
    expect(await deliver({ settings: { ...settings, alertEmails: [] } })).toMatchObject({ deferred: 1, failed: 0 })
    expect(mail.sent).toHaveLength(0)
    await ctx.payload.updateGlobal({ slug: 'site-settings', data: { contact: { email: null } } as never })

    const { id: license } = await createLicense(ctx)
    await ctx.run(`UPDATE customers SET email = '   ' WHERE id = ${ctx.ids.customer}`)
    const ev = await queued(license, 'suspended')
    await deliver({ settings })
    expect(JSON.parse(String((await row(ev)).detail)).notifyCustomerSuspendedAt).toBe('skipped')
    await ctx.run(`UPDATE customers SET email = '${CUSTOMER.email}' WHERE id = ${ctx.ids.customer}`)
  })
})
