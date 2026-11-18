import { sql } from '@payloadcms/db-sqlite'
import { createHash, randomBytes } from 'node:crypto'
import { BlockList, isIP } from 'node:net'
import type { Payload } from 'payload'

import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import { invalidateLicensingBlocks } from '../api/runtime'
import { normalizeIp, truncateIp } from '../crypto/ip'
import { RestoreError, restoreRuleSuspensionTx } from '../rules/restore'
import { LicensingKeyError, isSigningKeyRegistered, provisionSigningKeyTx } from '../signing'
import { LICENSE_TRANSITION_CONTEXT, type LicenseStatus, type LicenseTransitionContext } from '../transitions'
import { revokeConfirmation, suspensionKind } from './rules'

/*
 * L6b admin actions of the security center (plan §5.4). HTTP, the admin panel-session guard and input validation live
 * in ./endpoints.ts; this module is the transactional core.
 *
 * Every action is ONE short BEGIN IMMEDIATE transaction through the shared serial writer queue
 * (withPaymentTransaction -> src/lib/db-serial-transactions.ts). Inside it, in this order:
 *   1. idempotency: the admin request's receipt (`security-audit.nonce` = `admin:<action>:<target>:<requestId>`, unique)
 *      is looked up under the write lock; a retry of a committed request returns `replayed` and writes nothing;
 *   2. preconditions are RE-READ from the database (status, the status summary timestamp the admin saw, triage, block
 *      state, latest status log row); a mismatch is a refusal (409 `stale` / `invalid_transition` / ...) and rolls back;
 *   3. the change: license status through the Payload Local API with the transaction's `req`, so the L1 hooks stamp
 *      the license and append exactly one `license-status-log` row (source `admin`, reason `manual` or `restore`,
 *      actor, note, event); everything else as conditional SQL on the same connection;
 *   4. exactly one `security-audit` row (actor, action, target, reason, note, admin IP prefix, nonce, result `ok`).
 * The commit is confirmed by an independent read of the receipt before success is reported; post-commit effects
 * (block cache invalidation) run only then. Revocation is admin-only and requires a typed confirmation; nothing here
 * is reachable by the rule engine. Customer e-mails (manual suspension / restore) go through the L5 durable queue on
 * the `license.status_changed` event row (`action_taken = suspended`, `detail.restoredAt`), never inline.
 */

export type AdminActor = {
  id: number
  /** Truncated (/24, /48) prefix of the admin's trusted client address, stored on the audit row. */
  ipPrefix: string | null
  /** Trusted client address, used only to warn about blocking oneself; never stored or logged. */
  address: string | null
}

export { revokeConfirmation, suspensionKind }

export type ActionResult = { http: number; code: string; replayed?: true; data?: Record<string, string | number | null> }

type Common = { actor: AdminActor; requestId: string; reason: string; note?: string; now?: Date }
export type ExpectedLicenseState = { status: string; changedAt: string | null }

class Refusal extends Error {
  constructor(readonly http: number, readonly code: string) {
    super(code)
    this.name = 'LicensingAdminRefusal'
  }
}

function refuse(http: number, code: string): never {
  throw new Refusal(http, code)
}

type AuditTarget = { relationTo: 'licenses' | 'license-activations' | 'security-blocks' | 'security-events'; value: number }
type IdempotencyKey = { prefix: string; nonce: string }

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

function idempotencyOf(
  actorId: number,
  requestId: string,
  action: string,
  target: string,
  params: Record<string, unknown>,
): IdempotencyKey {
  const prefix = `admin:${actorId}:${requestId}:`
  const digest = createHash('sha256')
    .update(canonicalJson({ action, target, ...params }))
    .digest('hex')
    .slice(0, 32)
  return { prefix, nonce: `${prefix}${digest}` }
}

async function receiptExists(db: { all<T>(q: ReturnType<typeof sql>): Promise<T[]> }, nonce: string): Promise<boolean> {
  return (await db.all(sql`SELECT 1 FROM security_audit WHERE nonce = ${nonce} LIMIT 1`)).length > 0
}

async function findReceiptByPrefix(db: { all<T>(q: ReturnType<typeof sql>): Promise<T[]> }, prefix: string): Promise<string | null> {
  const end = `${prefix}\uffff`
  const [row] = await db.all<{ nonce: string }>(sql`SELECT nonce FROM security_audit WHERE nonce >= ${prefix} AND nonce < ${end} LIMIT 1`)
  return row?.nonce ?? null
}

async function writeAudit(payload: Payload, tx: PaymentTx, input: {
  action: string; actor: AdminActor; target?: AuditTarget; reason: string; note?: string; nonce: string; at: string
}): Promise<void> {
  await payload.create({
    collection: 'security-audit', req: tx.req, overrideAccess: true, depth: 0,
    data: {
      action: input.action, actorUser: input.actor.id, actorKind: 'admin',
      ...(input.target ? { target: input.target } : {}),
      reason: input.reason.slice(0, 500), note: input.note ? input.note.slice(0, 500) : null,
      at: input.at, ipPrefix: input.actor.ipPrefix, result: 'ok', nonce: input.nonce,
    } as never,
  })
}

/** Runs one admin action: receipt check, work, commit, receipt confirmation, post-commit effects. */
async function run(payload: Payload, key: IdempotencyKey, work: (tx: PaymentTx) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await withPaymentTransaction(payload, async (tx) => {
      const existing = await findReceiptByPrefix(tx, key.prefix)
      if (existing !== null) {
        if (existing !== key.nonce) refuse(409, 'idempotency_conflict')
        return { http: 200, code: 'replayed', replayed: true }
      }
      return work(tx)
    }, {
      confirm: async (result) => Boolean(result.replayed) || receiptExists(payload.db.drizzle, key.nonce),
    })
  } catch (error) {
    if (error instanceof Refusal) return { http: error.http, code: error.code }
    if (error instanceof RestoreError) return { http: error.code === 'not_found' ? 404 : 409, code: error.code }
    if (error instanceof LicensingKeyError) return { http: 409, code: error.code }
    throw error
  }
}

const sameInstant = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) return !a && !b
  return Date.parse(a) === Date.parse(b)
}

type LicenseRow = { id: number; status: string; status_changed_at: string | null; customer_id: number | null; public_id: string | null }
type LogRow = { id: number; from: string; to: string; source: string; reason: string | null; rule_key: string | null; event_id: number | null }

async function readLicense(tx: PaymentTx, id: number, expected: ExpectedLicenseState): Promise<{ license: LicenseRow; last: LogRow | null }> {
  const [license] = await tx.all<LicenseRow>(sql`SELECT id, status, status_changed_at, customer_id, public_id FROM licenses WHERE id = ${id}`)
  if (!license) refuse(404, 'not_found')
  if (license!.status !== expected.status || !sameInstant(license!.status_changed_at, expected.changedAt)) refuse(409, 'stale')
  const [last] = await tx.all<LogRow>(sql`SELECT id, "from", "to", source, reason, rule_key, event_id FROM license_status_log
    WHERE license_id = ${id} ORDER BY at DESC, id DESC LIMIT 1`)
  return { license: license!, last: last ?? null }
}

async function setLicenseStatus(payload: Payload, tx: PaymentTx, id: number, status: LicenseStatus, context: LicenseTransitionContext) {
  await payload.update({
    collection: 'licenses', id, req: tx.req, overrideAccess: true, depth: 0, select: { status: true },
    data: { status } as never,
    context: { [LICENSE_TRANSITION_CONTEXT]: context },
  })
}

/** A `license.status_changed` row: the admin-visible record and, for suspensions, the customer e-mail queue item. */
async function statusEvent(tx: PaymentTx, input: {
  license: LicenseRow; actor: AdminActor; at: string; from: string; to: string; severity: 'info' | 'medium'; notifyCustomer: boolean
}): Promise<number> {
  const { license, actor, at } = input
  const detail = JSON.stringify({ from: input.from, to: input.to, manual: true })
  const queue = input.notifyCustomer && license.customer_id !== null
  const [row] = await tx.all<{ id: number }>(sql`INSERT INTO security_events
      (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, license_id, customer_id, actor_user_id, detail,
       action_taken, triage, triaged_by_id, triaged_at, notify_state, notify_attempts, updated_at, created_at)
    VALUES ('license.status_changed', ${input.severity}, 'admin', ${at}, ${at}, 1,
      ${`admin|license.status_changed|license/${license.id}|${at}|${randomBytes(4).toString('hex')}`},
      ${license.id}, ${license.customer_id}, ${actor.id}, ${detail}, ${input.to === 'suspended' ? 'suspended' : 'none'},
      'resolved', ${actor.id}, ${at}, ${queue ? 'pending' : 'skipped'}, 0, ${at}, ${at})
    RETURNING id`)
  return Number(row!.id)
}

/** Re-arm the customer "re-enabled" e-mail on the suspension's event (sent only if the suspension e-mail went out). */
async function markEventRestored(tx: PaymentTx, event: number, at: string) {
  await tx.run(sql`UPDATE security_events SET
      detail = json_set(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.restoredAt', ${at}),
      notify_state = 'pending', notify_attempts = 0, notify_next_at = NULL, notify_last_error = NULL, updated_at = ${at}
    WHERE id = ${event}`)
}

// ---------------------------------------------------------------------------------------------------------------------
// Licenses

export type LicenseActionInput = Common & { license: number; expected: ExpectedLicenseState }

export function suspendLicense(payload: Payload, input: LicenseActionInput): Promise<ActionResult> {
  const at = (input.now ?? new Date()).toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'license.suspend', `licenses/${input.license}`, {
    expected: input.expected, reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    const { license } = await readLicense(tx, input.license, input.expected)
    if (license.status !== 'active') refuse(409, 'invalid_transition')
    const event = await statusEvent(tx, { license, actor: input.actor, at, from: 'active', to: 'suspended', severity: 'info', notifyCustomer: true })
    await setLicenseStatus(payload, tx, license.id, 'suspended', {
      source: 'admin', reason: 'manual', actorUser: input.actor.id, event, note: input.note, revertible: true,
    })
    await writeAudit(payload, tx, { action: 'license.suspend', actor: input.actor, target: { relationTo: 'licenses', value: license.id }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    return { http: 200, code: 'suspended' }
  })
}

export function revokeLicense(payload: Payload, input: LicenseActionInput & { confirm: string }): Promise<ActionResult> {
  const at = (input.now ?? new Date()).toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'license.revoke', `licenses/${input.license}`, {
    expected: input.expected, reason: input.reason, note: input.note, confirm: input.confirm.trim().toLowerCase(),
  })
  return run(payload, key, async (tx) => {
    const { license } = await readLicense(tx, input.license, input.expected)
    const expectedConfirm = revokeConfirmation(license.public_id)
    if (!expectedConfirm || input.confirm.trim().toLowerCase() !== expectedConfirm) refuse(400, 'confirmation_required')
    if (license.status !== 'active' && license.status !== 'suspended') refuse(409, 'invalid_transition')
    const event = await statusEvent(tx, { license, actor: input.actor, at, from: license.status, to: 'revoked', severity: 'medium', notifyCustomer: false })
    await setLicenseStatus(payload, tx, license.id, 'revoked', {
      source: 'admin', reason: 'manual', actorUser: input.actor.id, event, note: input.note, revertible: false,
    })
    const devices = await tx.run(sql`UPDATE license_activations SET status = 'revoked', end_reason = 'license_revoked',
        ended_at = ${at}, updated_at = ${at} WHERE license_id = ${license.id} AND status = 'active'`)
    await writeAudit(payload, tx, { action: 'license.revoke', actor: input.actor, target: { relationTo: 'licenses', value: license.id }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    return { http: 200, code: 'revoked', data: { devices } }
  })
}

/** Undo the latest suspension when it was a rule suspension (L5 core: false positive + suppression) or a manual one. */
export function restoreLicense(payload: Payload, input: LicenseActionInput): Promise<ActionResult> {
  const now = input.now ?? new Date()
  const at = now.toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'license.restore', `licenses/${input.license}`, {
    expected: input.expected, reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    const { license, last } = await readLicense(tx, input.license, input.expected)
    const kind = suspensionKind(license.status, last)
    if (kind === 'rule') {
      await restoreRuleSuspensionTx(payload, tx, {
        license: license.id, actorUser: input.actor.id, reason: input.reason, note: input.note, now, nonce: key.nonce, ipPrefix: input.actor.ipPrefix,
      })
      return { http: 200, code: 'restored' }
    }
    if (kind !== 'manual' || !last) return refuse(409, 'not_restorable')
    await setLicenseStatus(payload, tx, license.id, last.from as LicenseStatus, {
      source: 'admin', reason: 'restore', actorUser: input.actor.id, revertOf: Number(last.id),
      event: last.event_id ?? undefined, note: input.note, revertible: false,
    })
    if (last.event_id !== null) await markEventRestored(tx, Number(last.event_id), at)
    await writeAudit(payload, tx, { action: 'license.restore', actor: input.actor, target: { relationTo: 'licenses', value: license.id }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    return { http: 200, code: 'restored' }
  })
}

/**
 * Lift a suspension that `restore` does not cover (payment dispute won, system or direct panel edit). A rule or
 * manual suspension must use `restore` (409 `use_restore`) so suppression and the customer e-mail stay consistent.
 * Revoked is terminal for the actions (no reactivation of a revoked license here).
 */
export function reactivateLicense(payload: Payload, input: LicenseActionInput): Promise<ActionResult> {
  const at = (input.now ?? new Date()).toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'license.reactivate', `licenses/${input.license}`, {
    expected: input.expected, reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    const { license, last } = await readLicense(tx, input.license, input.expected)
    const kind = suspensionKind(license.status, last)
    if (kind === null) refuse(409, 'invalid_transition')
    if (kind === 'rule' || kind === 'manual') refuse(409, 'use_restore')
    await setLicenseStatus(payload, tx, license.id, 'active', {
      source: 'admin', reason: 'manual', actorUser: input.actor.id, note: input.note, revertible: false,
    })
    await writeAudit(payload, tx, { action: 'license.reactivate', actor: input.actor, target: { relationTo: 'licenses', value: license.id }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    return { http: 200, code: 'reactivated' }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Devices

export function deactivateActivation(payload: Payload, input: Common & { activation: number; mode: 'release' | 'revoke' }): Promise<ActionResult> {
  const at = (input.now ?? new Date()).toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'activation.deactivate', `license-activations/${input.activation}`, {
    mode: input.mode, reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    const [device] = await tx.all<{ id: number; status: string }>(sql`SELECT id, status FROM license_activations WHERE id = ${input.activation}`)
    if (!device) refuse(404, 'not_found')
    if (device!.status !== 'active') refuse(409, 'not_active')
    const status = input.mode === 'revoke' ? 'revoked' : 'deactivated'
    const changed = await tx.run(sql`UPDATE license_activations SET status = ${status}, end_reason = 'admin', ended_at = ${at}, updated_at = ${at}
      WHERE id = ${input.activation} AND status = 'active'`)
    if (changed !== 1) refuse(409, 'not_active')
    await writeAudit(payload, tx, {
      action: 'activation.deactivate', actor: input.actor, target: { relationTo: 'license-activations', value: input.activation },
      reason: input.reason, note: [input.mode, input.note].filter(Boolean).join(': '), nonce: key.nonce, at,
    })
    return { http: 200, code: input.mode === 'revoke' ? 'device_revoked' : 'device_released' }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Events

export type TriageAction = 'acknowledge' | 'resolve' | 'false-positive'
const TRIAGE_TARGET: Record<TriageAction, { to: string; from: readonly string[] }> = {
  acknowledge: { to: 'acknowledged', from: ['open'] },
  resolve: { to: 'resolved', from: ['open', 'acknowledged'] },
  'false-positive': { to: 'false_positive', from: ['open', 'acknowledged'] },
}

export function triageEvent(payload: Payload, input: Common & { event: number; action: TriageAction; expectedTriage: string; restore?: boolean }): Promise<ActionResult> {
  const now = input.now ?? new Date()
  const at = now.toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, `event.${input.action}`, `security-events/${input.event}`, {
    expectedTriage: input.expectedTriage, restore: Boolean(input.restore), reason: input.reason, note: input.note,
  })
  const rule = TRIAGE_TARGET[input.action]
  return run(payload, key, async (tx) => {
    const [event] = await tx.all<{ id: number; triage: string; source: string; license_id: number | null }>(sql`
      SELECT id, triage, source, license_id FROM security_events WHERE id = ${input.event}`)
    if (!event) refuse(404, 'not_found')
    if (event!.triage !== input.expectedTriage) refuse(409, 'stale')
    if (!rule.from.includes(event!.triage)) refuse(409, 'invalid_transition')
    const note = input.note?.slice(0, 500) ?? null

    if (input.action === 'false-positive' && input.restore) {
      // Restore only the suspension THIS event caused: the license's latest status row must be its rule suspension.
      if (event!.source !== 'rule' || event!.license_id === null) refuse(409, 'not_rule_suspension')
      const [last] = await tx.all<{ event_id: number | null }>(sql`SELECT event_id FROM license_status_log
        WHERE license_id = ${event!.license_id} ORDER BY at DESC, id DESC LIMIT 1`)
      if (!last || last.event_id === null || Number(last.event_id) !== event!.id) refuse(409, 'not_rule_suspension')
      await restoreRuleSuspensionTx(payload, tx, {
        license: Number(event!.license_id), actorUser: input.actor.id, reason: input.reason, note: input.note, now, nonce: key.nonce, ipPrefix: input.actor.ipPrefix,
      })
      await tx.run(sql`UPDATE security_events SET triage_note = ${note} WHERE id = ${event!.id}`)
      return { http: 200, code: 'restored' }
    }

    const changed = await tx.run(sql`UPDATE security_events SET triage = ${rule.to}, triaged_by_id = ${input.actor.id},
        triaged_at = ${at}, triage_note = ${note}, updated_at = ${at}
      WHERE id = ${event!.id} AND triage = ${event!.triage}`)
    if (changed !== 1) refuse(409, 'stale')
    await writeAudit(payload, tx, {
      action: 'event.triage', actor: input.actor, target: { relationTo: 'security-events', value: event!.id },
      reason: input.reason, note: [`${event!.triage} -> ${rule.to}`, input.note].filter(Boolean).join(': '), nonce: key.nonce, at,
    })
    return { http: 200, code: rule.to }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Blocks

export const BLOCK_DURATIONS_HOURS = [1, 24, 168] as const
export type BlockKindInput = 'ip_prefix' | 'cidr' | 'activation' | 'license' | 'fingerprint'

/** Canonical IP prefix (`a.b.c.0/24` or `x:y:z::/48`, the stored privacy prefix) or null. */
export function canonicalPrefix(value: string): string | null {
  const text = value.trim()
  const [base, bits, extra] = text.split('/')
  if (!base || !bits || extra !== undefined) return null
  const prefix = truncateIp(base)
  return prefix !== null && prefix === text ? prefix : null
}

/** CIDR with a sane minimum size (IPv4 /16 or narrower, IPv6 /32 or narrower), network bits masked. */
export function canonicalCidr(value: string): string | null {
  const [base, bits, extra] = value.trim().split('/')
  if (!base || !bits || extra !== undefined || !/^(0|[1-9]\d{0,2})$/.test(bits)) return null
  const ip = normalizeIp(base)
  const family = ip ? isIP(ip) : 0
  const n = Number(bits)
  if (!ip || !family || (family === 4 ? n < 16 || n > 32 : n < 32 || n > 128)) return null
  if (family === 4) {
    const octets = ip.split('.').map(Number)
    const addr = ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0
    const mask = (0xffffffff << (32 - n)) >>> 0
    const net = (addr & mask) >>> 0
    return `${[(net >>> 24) & 255, (net >>> 16) & 255, (net >>> 8) & 255, net & 255].join('.')}/${n}`
  }
  const [left, right] = ip.split('::')
  const head = left ? left.split(':').map((g) => Number.parseInt(g, 16)) : []
  const tail = right ? right.split(':').map((g) => Number.parseInt(g, 16)) : []
  const words = right !== undefined
    ? [...head, ...Array<number>(8 - head.length - tail.length).fill(0), ...tail]
    : head
  if (words.length !== 8) return null
  const masked = words.map((w, i) => {
    const bitStart = i * 16
    if (n <= bitStart) return 0
    if (n >= bitStart + 16) return w
    return w & ((0xffff << (16 - (n - bitStart))) & 0xffff)
  })
  const net = new URL(`http://[${masked.map((w) => w.toString(16)).join(':')}]`).hostname.slice(1, -1)
  return `${net}/${n}`
}

function blockMatchesAddress(kind: string, value: string, address: string | null): boolean {
  if (!address || (kind !== 'ip_prefix' && kind !== 'cidr')) return false
  const ip = normalizeIp(address)
  const [base, bits] = value.split('/')
  const family = ip && base ? isIP(ip) : 0
  if (!ip || !base || !bits || !family || isIP(base) !== family) return false
  const list = new BlockList()
  const type = family === 4 ? 'ipv4' : 'ipv6'
  try {
    list.addSubnet(base, Number(bits), type)
    return list.check(ip, type)
  } catch {
    return false
  }
}

export type CreateBlockInput = Common & {
  kind: BlockKindInput
  /** ip_prefix / cidr text. */
  value?: string
  /** activation / fingerprint blocks reference a device; license blocks a license. */
  activation?: number
  license?: number
  /** Block taken from an event (`POST /api/security-events/:id/block`): the value comes from the event row. */
  event?: number
  scope: 'api' | 'all'
  durationHours: (typeof BLOCK_DURATIONS_HOURS)[number] | null
  confirmSelf?: boolean
}

export function createBlock(payload: Payload, input: CreateBlockInput): Promise<ActionResult> {
  const now = input.now ?? new Date()
  const at = now.toISOString()
  const target = input.event !== undefined ? `security-events/${input.event}` : 'security-blocks/new'
  const key = idempotencyOf(input.actor.id, input.requestId, 'block.add', target, {
    kind: input.kind, value: input.value, activation: input.activation, license: input.license,
    event: input.event, scope: input.scope, durationHours: input.durationHours,
    confirmSelf: Boolean(input.confirmSelf), reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    let activation = input.activation
    let license = input.license
    let value: string | null = null
    if (input.event !== undefined) {
      const [event] = await tx.all<{ id: number; ip_prefix: string | null; activation_id: number | null; license_id: number | null }>(sql`
        SELECT id, ip_prefix, activation_id, license_id FROM security_events WHERE id = ${input.event}`)
      if (!event) refuse(404, 'not_found')
      if (input.kind === 'ip_prefix') value = event!.ip_prefix ? canonicalPrefix(event!.ip_prefix) : null
      activation = event!.activation_id ?? undefined
      license = event!.license_id ?? undefined
    } else if (input.kind === 'ip_prefix') value = canonicalPrefix(input.value ?? '')
    if (input.kind === 'cidr') value = canonicalCidr(input.value ?? '')
    if (input.kind === 'activation' || input.kind === 'fingerprint') {
      if (activation === undefined) refuse(400, 'invalid_target')
      const [device] = await tx.all<{ public_id: string; fingerprint_hash: string }>(sql`
        SELECT public_id, fingerprint_hash FROM license_activations WHERE id = ${activation}`)
      if (!device) refuse(404, 'not_found')
      value = input.kind === 'activation' ? device!.public_id : device!.fingerprint_hash
    }
    if (input.kind === 'license') {
      if (license === undefined) refuse(400, 'invalid_target')
      const [row] = await tx.all<{ public_id: string | null }>(sql`SELECT public_id FROM licenses WHERE id = ${license}`)
      if (!row) refuse(404, 'not_found')
      value = row!.public_id
    }
    if (!value) return refuse(400, 'invalid_value')
    if (blockMatchesAddress(input.kind, value, input.actor.address) && !input.confirmSelf) refuse(409, 'self_block_confirmation_required')
    const [existing] = await tx.all(sql`SELECT 1 FROM security_blocks WHERE kind = ${input.kind} AND value = ${value}
      AND scope = ${input.scope} AND active = 1 AND (expires_at IS NULL OR expires_at > ${at}) LIMIT 1`)
    if (existing) refuse(409, 'already_blocked')
    const expiresAt = input.durationHours === null ? null : new Date(now.getTime() + input.durationHours * 3_600_000).toISOString()
    const [row] = await tx.all<{ id: number }>(sql`INSERT INTO security_blocks
        (kind, value, scope, active, expires_at, source, reason, event_id, created_by_id, created_at, updated_at)
      VALUES (${input.kind}, ${value}, ${input.scope}, 1, ${expiresAt}, 'admin', ${input.reason.slice(0, 500)},
        ${input.event ?? null}, ${input.actor.id}, ${at}, ${at})
      RETURNING id`)
    const id = Number(row!.id)
    await writeAudit(payload, tx, { action: 'block.add', actor: input.actor, target: { relationTo: 'security-blocks', value: id }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    tx.afterCommit(() => invalidateLicensingBlocks(payload))
    return { http: 200, code: 'blocked', data: { block: id, expiresAt } }
  })
}

export function liftBlock(payload: Payload, input: Common & { block: number }): Promise<ActionResult> {
  const at = (input.now ?? new Date()).toISOString()
  const key = idempotencyOf(input.actor.id, input.requestId, 'block.lift', `security-blocks/${input.block}`, {
    reason: input.reason, note: input.note,
  })
  return run(payload, key, async (tx) => {
    const [block] = await tx.all<{ id: number; active: number | null }>(sql`SELECT id, active FROM security_blocks WHERE id = ${input.block}`)
    if (!block) refuse(404, 'not_found')
    if (!block!.active) refuse(409, 'already_lifted')
    const changed = await tx.run(sql`UPDATE security_blocks SET active = 0, lifted_at = ${at}, lifted_by_id = ${input.actor.id},
        lift_reason = ${input.reason.slice(0, 500)}, updated_at = ${at} WHERE id = ${input.block} AND active = 1`)
    if (changed !== 1) refuse(409, 'already_lifted')
    await writeAudit(payload, tx, { action: 'block.lift', actor: input.actor, target: { relationTo: 'security-blocks', value: input.block }, reason: input.reason, note: input.note, nonce: key.nonce, at })
    tx.afterCommit(() => invalidateLicensingBlocks(payload))
    return { http: 200, code: 'lifted' }
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Signing key

/** Typed confirmation for a rotation (plan §5.4: "DÖNDÜR"; the English admin types "ROTATE"). */
export const ROTATION_CONFIRMATIONS = ['DÖNDÜR', 'ROTATE'] as const

export function rotateSigningKey(payload: Payload, input: Common & { confirm: string; env?: Record<string, string | undefined> }): Promise<ActionResult> {
  const now = input.now ?? new Date()
  const at = now.toISOString()
  const typed = input.confirm.trim().normalize('NFC').toLocaleUpperCase('tr')
  if (!(ROTATION_CONFIRMATIONS as readonly string[]).includes(typed)) return Promise.resolve({ http: 400, code: 'confirmation_required' })
  const key = idempotencyOf(input.actor.id, input.requestId, 'signing_key.rotate', 'licensing-settings', {
    reason: input.reason, note: input.note, confirm: typed,
  })
  return run(payload, key, async (tx) => {
    const rotated = await provisionSigningKeyTx(payload, tx, { rotate: true, now, ...(input.env ? { env: input.env } : {}) })
    const detail = JSON.stringify({ kid: rotated.kid, notifyAdminWant: 'high' })
    await tx.run(sql`INSERT INTO security_events
        (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, actor_user_id, detail, action_taken, triage,
         notify_state, notify_attempts, updated_at, created_at)
      VALUES ('system.signing_key_rotated', 'high', 'admin', ${at}, ${at}, 1,
        ${`system.signing_key_rotated|${rotated.kid}`}, ${input.actor.id}, ${detail}, 'none', 'open', 'pending', 0, ${at}, ${at})`)
    await writeAudit(payload, tx, { action: 'signing_key.rotate', actor: input.actor, reason: input.reason, note: [`kid ${rotated.kid}`, input.note].filter(Boolean).join(': '), nonce: key.nonce, at })
    tx.afterCommit(async () => {
      if (!(await isSigningKeyRegistered(payload, rotated))) payload.logger.error('licensing: rotated signing key not visible after commit')
    })
    return { http: 200, code: 'rotated', data: { kid: rotated.kid } }
  })
}
