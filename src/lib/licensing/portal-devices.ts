import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import { displayDeviceLabel } from './device-metadata'
import { isPublicId } from './public-id'

/*
 * L7a customer portal device release (plan §8 portal row). The transactional core behind the portal server action;
 * HTTP/session/origin/rate-limit checks live in src/lib/portal/device-actions.ts.
 *
 * One short BEGIN IMMEDIATE transaction through the shared serial writer queue (withPaymentTransaction). Inside it:
 *   1. idempotency: the form's request token is the receipt (`security-audit.nonce` = `portal:<customer>:<token>`, unique);
 *      a retry of a committed request for the same owned device returns `replayed` and writes nothing;
 *   2. ownership is RE-READ from the database under the write lock: the license must belong to this customer
 *      (`licenses.customer_id`) and the activation to that license AND customer; anything else is `not_found`
 *      (identical for "does not exist" and "belongs to someone else");
 *   3. the quota: devices of this license released from the portal in the last 30 days must stay below the licensing
 *      settings value `selfService.portalDeactivationsPer30Days` (0 switches portal release off);
 *   4. the change: ONE conditional UPDATE (active -> deactivated, end_reason `customer_portal`), which the L5 churn
 *      rule already counts; one `activation.ended` security event (source `portal`, queued for the customer's
 *      "device released" e-mail in the L5 durable queue); one `security-audit` row (actor kind `system`, reason
 *      `customer_portal`, no admin actor, the receipt above).
 * The license STATUS never changes here (a released device only frees a seat), so no `license-status-log` row exists
 * for this action: the audit row and the event are its records. The commit is confirmed by an independent read of the
 * receipt before success is reported. Nothing sensitive is stored: no IP, no fingerprint, no e-mail.
 */

export const PORTAL_DEVICE_WINDOW_DAYS = 30
export const DEFAULT_PORTAL_RELEASES = 3
const DAY_MS = 86_400_000

export type ReleaseCode = 'released' | 'replayed' | 'not_found' | 'not_active' | 'revoked' | 'limit' | 'disabled'
export type ReleaseResult = { ok: boolean; code: ReleaseCode }

export type PortalDevice = {
  /** Opaque public id (never the numeric database id). */
  id: string
  label: string | null
  platform: string | null
  activatedAt: string
  lastSeenAt: string | null
  country: string | null
}

export type PortalDeviceSummary = { devices: PortalDevice[]; used: number; max: number | null; releasesLeft: number; releaseLimit: number }

export const TOKEN_RE = /^[0-9a-f]{32}$/

const releaseLimit = sql`COALESCE((SELECT self_service_portal_deactivations_per30_days
  FROM licensing_settings LIMIT 1), ${DEFAULT_PORTAL_RELEASES})`
const clampLimit = (value: number) => Number.isFinite(value) ? Math.min(50, Math.max(0, Math.floor(value))) : 0
const releaseCount = (license: ReturnType<typeof sql>, now: Date) => sql`(SELECT count(*) FROM license_activations
  WHERE license_id = ${license} AND end_reason = 'customer_portal'
    AND ended_at > ${new Date(now.getTime() - PORTAL_DEVICE_WINDOW_DAYS * DAY_MS).toISOString()})`

type DeviceRow = {
  public_id: string | null
  device_label: string | null
  platform: string | null
  activated_at: string | null
  last_seen_at: string | null
  last_country: string | null
}

/**
 * Check current license ownership and read its device summary in one statement. Only display columns are selected.
 */
export async function listPortalDevices(
  payload: Payload, input: { licenseId: number; customerId: number; now?: Date },
): Promise<PortalDeviceSummary | null> {
  const rows = await payload.db.drizzle.all<DeviceRow & { max: number | null; quota: number; released: number }>(sql`
    WITH owned AS (
      SELECT l.id, l.customer_id, COALESCE(l.max_devices, l.seats) AS max, ${releaseLimit} AS quota,
        ${releaseCount(sql`l.id`, input.now ?? new Date())} AS released
      FROM licenses l WHERE l.id = ${input.licenseId} AND l.customer_id = ${input.customerId}
    )
    SELECT o.max, o.quota, o.released, a.public_id, a.device_label, a.platform, a.activated_at, a.last_seen_at, a.last_country
    FROM owned o LEFT JOIN license_activations a ON a.license_id = o.id AND a.customer_id = o.customer_id AND a.status = 'active'
    ORDER BY a.activated_at DESC, a.id DESC`)
  const [owned] = rows
  if (!owned) return null
  const limit = clampLimit(owned.quota)
  const devices = rows.flatMap((r) => r.public_id && r.activated_at ? [{
    id: r.public_id,
    label: displayDeviceLabel(r.device_label),
    platform: r.platform,
    activatedAt: r.activated_at,
    lastSeenAt: r.last_seen_at,
    country: r.last_country && /^[A-Z]{2}$/.test(r.last_country) ? r.last_country : null,
  }] : [])
  return {
    devices,
    used: devices.length,
    max: owned.max,
    releaseLimit: limit,
    releasesLeft: Math.max(0, limit - owned.released),
  }
}

export async function releasePortalDevice(payload: Payload, input: {
  customerId: number
  license: string
  activation: string
  token: string
  now?: Date
}): Promise<ReleaseResult> {
  if (!isPublicId(input.license) || !isPublicId(input.activation) || !TOKEN_RE.test(input.token)) return { ok: false, code: 'not_found' }
  const nonce = `portal:${input.customerId}:${input.token}`
  const receipt = async (db: Pick<PaymentTx, 'all'>) => (await db.all<{ activation_id: number | null }>(sql`
    SELECT r.license_activations_id AS activation_id FROM security_audit s
    LEFT JOIN security_audit_rels r ON r.parent_id = s.id AND r.path = 'target'
    WHERE s.nonce = ${nonce}`))[0]
  let releasedDeviceId: number | undefined

  return withPaymentTransaction<ReleaseResult>(payload, async (tx) => {
    const [license] = await tx.all<{ id: number; status: string }>(sql`SELECT id, status FROM licenses
      WHERE public_id = ${input.license} AND customer_id = ${input.customerId}`)
    if (!license) return { ok: false, code: 'not_found' }
    const [device] = await tx.all<{ id: number; status: string }>(sql`SELECT id, status FROM license_activations
      WHERE public_id = ${input.activation} AND license_id = ${license.id} AND customer_id = ${input.customerId}`)
    if (!device) return { ok: false, code: 'not_found' }
    const prior = await receipt(tx)
    if (prior) return prior.activation_id === device.id ? { ok: true, code: 'replayed' } : { ok: false, code: 'not_found' }
    if (license.status === 'revoked') return { ok: false, code: 'revoked' }
    if (device.status !== 'active') return { ok: false, code: 'not_active' }
    const now = input.now ?? new Date()
    const at = now.toISOString()
    const [quota] = await tx.all<{ quota: number; released: number }>(sql`SELECT ${releaseLimit} AS quota,
      ${releaseCount(sql`${license.id}`, now)} AS released`)
    const limit = clampLimit(quota!.quota)
    if (limit < 1) return { ok: false, code: 'disabled' }
    if (quota!.released >= limit) return { ok: false, code: 'limit' }

    const changed = await tx.run(sql`UPDATE license_activations SET status = 'deactivated', end_reason = 'customer_portal',
      ended_at = ${at}, updated_at = ${at} WHERE id = ${device.id} AND status = 'active'`)
    if (changed !== 1) return { ok: false, code: 'not_active' }

    // The customer's own "device released" e-mail is queued on this row (L5 durable queue, sent after commit).
    await tx.run(sql`INSERT INTO security_events
        (type, severity, source, first_seen_at, last_seen_at, count, dedupe_key, license_id, customer_id, activation_id,
         detail, action_taken, triage, notify_state, notify_attempts, updated_at, created_at)
      VALUES ('activation.ended', 'info', 'portal', ${at}, ${at}, 1, ${`portal|activation.ended|activation/${device.id}|${at}`},
        ${license.id}, ${input.customerId}, ${device.id}, ${JSON.stringify({ reason: 'customer_portal', notifyDeviceReleased: true })},
        'none', 'resolved', 'pending', 0, ${at}, ${at})`)
    await payload.create({
      collection: 'security-audit', req: tx.req, overrideAccess: true, depth: 0,
      data: {
        action: 'activation.deactivate', actorKind: 'system',
        target: { relationTo: 'license-activations', value: device.id },
        reason: 'customer_portal', note: 'released by the license owner in the portal', at, result: 'ok', nonce,
      },
    })
    releasedDeviceId = device.id
    return { ok: true, code: 'released' }
  }, { confirm: async (result) => result.code !== 'released'
    || (releasedDeviceId !== undefined && (await receipt(payload.db.drizzle))?.activation_id === releasedDeviceId) })
}
