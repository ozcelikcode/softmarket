import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import { LICENSE_TRANSITION_CONTEXT, type LicenseStatus, type LicenseTransitionContext } from '../transitions'

/*
 * "False positive - restore" (plan §5.3). Server-side core for the L6b admin endpoint (which adds guardAdminSession,
 * the reason form and the HTTP mapping); no route is exposed in L5.
 *
 * In ONE BEGIN IMMEDIATE transaction:
 *   1. the license's LAST status log row must be an automatic rule suspension (source `rule`, to `suspended`, reason
 *      `rule_*`) and the license must still be `suspended`; anything else (a payment dispute, an admin change, a later
 *      transition) -> RestoreError('not_rule_suspension') = HTTP 409, the admin acts manually;
 *   2. the license returns to the row's `from` status through the Local API (L1 hooks log source `admin`, reason
 *      `restore`, `revertOf` = the suspension row, the rule key and the event);
 *   3. the rule event becomes `false_positive` with `detail.restoredAt`, and its notification is re-armed so the
 *      customer gets the "re-enabled" e-mail when they had received the suspension e-mail;
 *   4. one `security-audit` row (`license.restore`).
 * Suppression needs no extra row: the sweep treats a `restore` log row with that rule key (and a `false_positive`
 * rule event) as "suppressed for suppressDays".
 */

export class RestoreError extends Error {
  readonly status = 409
  constructor(readonly code: 'not_rule_suspension' | 'not_found') {
    super(`licensing restore: ${code}`)
    this.name = 'RestoreError'
  }
}

export type RestoreInput = {
  license: number
  actorUser: number
  reason: string
  note?: string
  now?: Date
  /** L6b: idempotency receipt of the admin request (unique `security-audit.nonce`) and the admin's IP prefix. */
  nonce?: string
  ipPrefix?: string | null
}

export async function restoreRuleSuspension(payload: Payload, input: RestoreInput): Promise<{ logId: number; event: number | null }> {
  return withPaymentTransaction(payload, (tx) => restoreRuleSuspensionTx(payload, tx, input))
}

/** Same as restoreRuleSuspension inside a caller's BEGIN IMMEDIATE transaction (the L6b admin endpoints). */
export async function restoreRuleSuspensionTx(payload: Payload, tx: PaymentTx, input: RestoreInput): Promise<{ logId: number; event: number | null }> {
  const now = input.now ?? new Date()
  const at = now.toISOString()
  {
    const [license] = await tx.all<{ status: string }>(sql`SELECT status FROM licenses WHERE id = ${input.license}`)
    if (!license) throw new RestoreError('not_found')
    const [last] = await tx.all<{ id: number; from: string; to: string; source: string; reason: string | null; rule_key: string | null; event_id: number | null }>(sql`
      SELECT id, "from", "to", source, reason, rule_key, event_id FROM license_status_log
      WHERE license_id = ${input.license} ORDER BY at DESC, id DESC LIMIT 1`)
    if (!last || last.source !== 'rule' || last.to !== 'suspended' || !last.reason?.startsWith('rule_')
      || license.status !== 'suspended' || !last.rule_key) throw new RestoreError('not_rule_suspension')

    const context: LicenseTransitionContext = {
      source: 'admin', reason: 'restore', actorUser: input.actorUser, revertOf: Number(last.id), ruleKey: last.rule_key,
      event: last.event_id ?? undefined, note: input.note?.slice(0, 500), revertible: false,
    }
    await payload.update({
      collection: 'licenses', id: input.license, req: tx.req, overrideAccess: true, depth: 0,
      data: { status: last.from as LicenseStatus } as never,
      context: { [LICENSE_TRANSITION_CONTEXT]: context },
    })
    if (last.event_id !== null) {
      await tx.run(sql`UPDATE security_events SET triage = 'false_positive', triaged_by_id = ${input.actorUser}, triaged_at = ${at},
          detail = json_set(CASE WHEN json_valid(detail) THEN detail ELSE '{}' END, '$.restoredAt', ${at}),
          notify_state = 'pending', notify_attempts = 0, notify_next_at = NULL, notify_last_error = NULL, updated_at = ${at}
        WHERE id = ${last.event_id}`)
    }
    await payload.create({
      collection: 'security-audit', req: tx.req, overrideAccess: true, depth: 0,
      data: {
        action: 'license.restore', actorUser: input.actorUser, actorKind: 'admin',
        target: { relationTo: 'licenses', value: input.license },
        reason: input.reason.slice(0, 500), note: input.note?.slice(0, 500), at, result: 'ok',
        ...(input.nonce ? { nonce: input.nonce } : {}), ...(input.ipPrefix ? { ipPrefix: input.ipPrefix } : {}),
      } as never,
    })
    return { logId: Number(last.id), event: last.event_id === null ? null : Number(last.event_id) }
  }
}
