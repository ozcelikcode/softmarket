import { sql } from '@payloadcms/db-sqlite'
import { createHash } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'

import { isAdminUser } from '@/access/roles'
import { requestIP } from '@/lib/forms/security'
import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import { truncateIp } from '../crypto/ip'
import type { LicensingAdminRoute } from './endpoints'

/*
 * L6b follow-up: refused admin actions leave a `security-audit` row with result `denied`, for callers that were
 * identified as a user (panel/customer/API key). Anonymous 401s are not audited here (rate-limited elsewhere).
 *
 * No schema change: the row reuses existing columns.
 *   - `action`     the route's audit action (license.suspend ... signing_key.rotate);
 *   - `reason`     a fixed reason code (`forbidden`, `stale`, `invalid_transition`, `invalid_reason`, ...), never request text;
 *   - `note`       `count=<n> http=<status>`: the coalescing counter;
 *   - `ipPrefix`   the caller's /24 (IPv4) or /48 (IPv6) prefix, never the full address;
 *   - `actorUser`  only for users-collection callers (a customer is not a users document); `actorKind` is `admin` for an
 *                  admin and `system` for any other caller; `target` only when the document exists;
 *   - `nonce`      `denied:<key hash>:<window start ms>` (unique), where the key is (actor or IP prefix, action, reason).
 * Coalescing: at most one denied row per key per 10 minutes. A repeat inside the window increments the counter of the
 * row that opened it (one write transaction, so concurrent refusals cannot create two rows).
 * No security event: no existing event type fits repeated forbidden admin actions, and a new type would be a stored
 * enum change.
 */

export const DENIED_WINDOW_MS = 10 * 60 * 1000

const AUDIT_ACTION: Record<LicensingAdminRoute, string> = {
  'license.suspend': 'license.suspend',
  'license.revoke': 'license.revoke',
  'license.restore': 'license.restore',
  'license.reactivate': 'license.reactivate',
  'activation.deactivate': 'activation.deactivate',
  'event.acknowledge': 'event.triage',
  'event.resolve': 'event.triage',
  'event.false-positive': 'event.triage',
  'event.block': 'block.add',
  'block.add': 'block.add',
  'block.lift': 'block.lift',
  'signing-key.rotate': 'signing_key.rotate',
}

const TARGET: Partial<Record<LicensingAdminRoute, { relationTo: 'licenses' | 'license-activations' | 'security-blocks' | 'security-events'; table: string }>> = {
  'license.suspend': { relationTo: 'licenses', table: 'licenses' },
  'license.revoke': { relationTo: 'licenses', table: 'licenses' },
  'license.restore': { relationTo: 'licenses', table: 'licenses' },
  'license.reactivate': { relationTo: 'licenses', table: 'licenses' },
  'activation.deactivate': { relationTo: 'license-activations', table: 'license_activations' },
  'event.acknowledge': { relationTo: 'security-events', table: 'security_events' },
  'event.resolve': { relationTo: 'security-events', table: 'security_events' },
  'event.false-positive': { relationTo: 'security-events', table: 'security_events' },
  'event.block': { relationTo: 'security-events', table: 'security_events' },
  'block.lift': { relationTo: 'security-blocks', table: 'security_blocks' },
}

const REASON_RE = /^[a-z][A-Za-z0-9_]{1,48}$/

export type DeniedInput = {
  route: LicensingAdminRoute
  /** Fixed reason code (the response `code`). */
  code: string
  http: number
  /** Numeric target id from the URL, when it parsed. */
  targetId?: number
  now?: Date
}

/** Never throws and never changes the response: an audit failure is logged by code only. */
export async function recordDeniedAdminAction(req: PayloadRequest, input: DeniedInput): Promise<void> {
  try {
    const user = req.user as ({ id?: unknown; collection?: string } & PayloadRequest['user']) | null | undefined
    if (!user) return
    if (!REASON_RE.test(input.code)) return
    const payload: Payload = req.payload
    const address = requestIP(req.headers)
    const ipPrefix = address === 'unknown' ? null : truncateIp(address)
    const staffId = user.collection === 'users' && typeof user.id === 'number' && Number.isSafeInteger(user.id) && user.id > 0 ? user.id : null
    const action = AUDIT_ACTION[input.route]
    const who = staffId !== null ? `u${staffId}` : `${user.collection ?? 'x'}:${ipPrefix ?? 'unknown'}`
    const hash = createHash('sha256').update(`${who}|${action}|${input.code}`).digest('hex').slice(0, 24)
    const prefix = `denied:${hash}:`
    const now = input.now ?? new Date()
    if (!Number.isFinite(now.getTime())) return
    const spec = TARGET[input.route]

    await withPaymentTransaction(payload, async (tx) => {
      const [open] = await tx.all<{ id: number; at: string; note: string | null }>(
        sql`SELECT id, at, note FROM security_audit WHERE nonce >= ${prefix} AND nonce < ${`${prefix}\uffff`} ORDER BY at DESC LIMIT 1`,
      )
      const openAtMs = open ? Date.parse(open.at) : NaN
      if (open && Number.isFinite(openAtMs) && now.getTime() - openAtMs < DENIED_WINDOW_MS) {
        const seen = Number(/^count=(\d+)\b/.exec(open.note ?? '')?.[1] ?? 1)
        const nextCount = Number.isSafeInteger(seen) && seen >= 1 ? seen + 1 : 2
        await tx.run(sql`UPDATE security_audit SET note = ${`count=${nextCount} http=${input.http}`} WHERE id = ${open.id}`)
        return
      }
      let target: { relationTo: NonNullable<typeof spec>['relationTo']; value: number } | undefined
      if (spec && input.targetId !== undefined) {
        const found = await tx.all<{ one: number }>(sql`SELECT 1 AS one FROM ${sql.raw(spec.table)} WHERE id = ${input.targetId} LIMIT 1`)
        if (found.length) target = { relationTo: spec.relationTo, value: input.targetId }
      }
      await payload.create({
        collection: 'security-audit', req: tx.req, overrideAccess: true, depth: 0,
        data: {
          action, actorKind: isAdminUser(user) ? 'admin' : 'system',
          ...(staffId !== null ? { actorUser: staffId } : {}),
          ...(target ? { target } : {}),
          reason: input.code, note: `count=1 http=${input.http}`,
          at: now.toISOString(), ipPrefix, result: 'denied', nonce: `${prefix}${now.getTime()}`,
        } as never,
      })
    })
  } catch (error) {
    req.payload.logger.error(`licensing denied audit failed route=${input.route} code=${error instanceof Error ? error.name : 'error'}`)
  }
}
