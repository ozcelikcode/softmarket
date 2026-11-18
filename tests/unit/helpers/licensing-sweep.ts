import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

import { LICENSE_TRANSITION_CONTEXT } from '../../../src/lib/licensing/transitions'
import type { Ctx } from './licensing-db'

/*
 * L5 fixtures on the temporary licensing DB (helpers/licensing-db.ts): raw activation and event rows with relative
 * timestamps, rule settings, an SMTP stub that records messages instead of sending, and log capture.
 */

export const HOUR = 3_600_000
export const ago = (ms: number, now = Date.now()) => new Date(now - ms).toISOString()
const hex = (n: number) => randomBytes(n).toString('hex')
const q = (value: string | number | null | undefined) =>
  value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`

export type ActivationFixture = {
  status?: 'active' | 'deactivated' | 'revoked'
  activatedAt?: string
  lastSeenAt?: string | null
  endedAt?: string | null
  endReason?: string | null
  prefix?: string | null
  ipHash?: string | null
  country?: string | null
}

export async function insertActivation(ctx: Ctx, license: number, f: ActivationFixture = {}): Promise<number> {
  const [lic] = (await ctx.run(`SELECT customer_id, product_id FROM licenses WHERE id = ${license}`)).rows
  const res = await ctx.run(`INSERT INTO license_activations (public_id, license_id, customer_id, product_id, status, end_reason,
      device_public_key, device_key_thumbprint, fingerprint_hash, activated_at, last_seen_at, ended_at, last_ip_prefix, last_ip_hash, last_country)
    VALUES (${q(hex(12))}, ${license}, ${q(lic?.customer_id as number)}, ${q(lic?.product_id as number)}, ${q(f.status ?? 'active')}, ${q(f.endReason)},
      ${q(hex(16))}, ${q(hex(16))}, ${q(hex(32))}, ${q(f.activatedAt ?? ago(48 * HOUR))}, ${q(f.lastSeenAt)}, ${q(f.endedAt)},
      ${q(f.prefix)}, ${q(f.ipHash)}, ${q(f.country)}) RETURNING id`)
  return Number(res.rows[0]!.id)
}

export type EventFixture = {
  type: string
  severity?: string
  source?: string
  license?: number | null
  activation?: number | null
  firstSeenAt?: string
  lastSeenAt?: string
  count?: number
  prefix?: string | null
  ipHash?: string | null
  country?: string | null
  notifyState?: string | null
  triage?: string
}

export async function insertEvent(ctx: Ctx, f: EventFixture): Promise<number> {
  const last = f.lastSeenAt ?? ago(0)
  const res = await ctx.run(`INSERT INTO security_events (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key,
      license_id, activation_id, ip_prefix, ip_hash, country, notify_state, triage)
    VALUES (${q(f.type)}, ${q(f.severity ?? 'low')}, ${q(f.source ?? 'api')}, ${q(f.firstSeenAt ?? last)}, ${q(last)}, ${f.count ?? 1},
      ${q(`fixture|${hex(8)}`)}, ${q(f.license)}, ${q(f.activation)}, ${q(f.prefix)}, ${q(f.ipHash)}, ${q(f.country)},
      ${q(f.notifyState)}, ${q(f.triage ?? 'open')}) RETURNING id`)
  return Number(res.rows[0]!.id)
}

export async function setSettings(payload: Payload, data: Record<string, unknown>) {
  await payload.updateGlobal({ slug: 'licensing-settings', data: data as never })
}

/** Every rule off except the given ones (with their mode). */
export function rulesOnly(modes: Record<string, string>, extra: Record<string, unknown> = {}) {
  const all = ['ipSpread', 'geoSpread', 'impossibleTravel', 'activationBurst', 'activationChurn', 'cloneSuspected']
  return { ...Object.fromEntries(all.map((k) => [k, { mode: modes[k] ?? 'off' }])), ...extra }
}

/** Server-side status change with a declared source (payment, admin …), the way the existing code paths do it. */
export async function transition(payload: Payload, license: number, status: string, context: Record<string, unknown>) {
  await payload.update({
    collection: 'licenses', id: license, overrideAccess: true, data: { status } as never,
    context: { [LICENSE_TRANSITION_CONTEXT]: context },
  })
}

export type Mail = { to: unknown; subject: string; text: string; html: string }

export function stubMail(payload: Payload) {
  const sent: Mail[] = []
  const original = payload.sendEmail
  let fail: (() => boolean) | null = null
  payload.sendEmail = (async (message: Mail) => {
    if (fail?.()) throw new Error('smtp down 10.1.2.3 customer.l1@example.test')
    sent.push(message)
    return {}
  }) as never
  process.env.SMTP_HOST = 'smtp.l5.test'
  process.env.SMTP_FROM = 'noreply@l5.test'
  return {
    sent,
    failWhen: (fn: (() => boolean) | null) => { fail = fn },
    restore: () => {
      payload.sendEmail = original
      delete process.env.SMTP_HOST
      delete process.env.SMTP_FROM
    },
  }
}

export function captureLog() {
  const lines: string[] = []
  const log = {
    info: (m: string) => void lines.push(m),
    warn: (m: string) => void lines.push(m),
    error: (m: string) => void lines.push(m),
  }
  return { lines, log }
}

export async function resetLicensingRows(ctx: Ctx) {
  for (const table of ['security_events', 'license_status_log', 'license_activations', 'security_audit_rels', 'security_audit', 'security_blocks']) {
    await ctx.run(`DELETE FROM ${table}`)
  }
}
