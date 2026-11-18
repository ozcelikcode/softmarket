import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'

import { isAdminUser, isStaffUser } from '@/access/roles'
import type { LicensingSetting } from '@/payload-types'

import {
  LICENSE_STATUSES,
  LICENSE_STATUS_REASONS,
  LICENSE_STATUS_SOURCES,
  LICENSING_RULE_KEYS,
  TRANSITION_SOURCES,
  type LicenseStatusReason,
  type TransitionSource,
} from './constants'

/*
 * Permanent rule 1 (docs/plan-licensing-security.md): every license status change writes a `license-status-log` row
 * in the SAME transaction. L1 wires the Payload write path (panel, Local API, MCP is blocked by field access):
 *   - `stampLicenseTransition` (beforeChange) sets statusChangedAt/statusSource/statusReason when the status changes;
 *   - `logLicenseTransition` (afterChange, still inside the operation transaction) appends the log row.
 * Server code that changes a status declares why through `req.context[LICENSE_TRANSITION_CONTEXT]`. The raw-SQL paths
 * in src/lib/payments/admin-actions.ts (refund/dispute) call recordLicenseTransition in their order transaction (plan §5.3).
 */

export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export type LicenseTransitionContext = {
  source?: TransitionSource
  reason?: LicenseStatusReason
  actorUser?: number
  order?: number
  event?: number
  ruleKey?: string
  /** Free text, max 500 characters. Never put personal data (e-mail, IP, license key) here. */
  note?: string
  revertOf?: number
  revertible?: boolean
}

export const LICENSE_TRANSITION_CONTEXT = 'licenseTransition'

export type LicenseTransitionInput = LicenseTransitionContext & {
  license: number
  from: LicenseStatus
  to: LicenseStatus
  source: TransitionSource
  at?: string
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value)

const readContext = (req: PayloadRequest): LicenseTransitionContext => {
  const raw = req.context?.[LICENSE_TRANSITION_CONTEXT]
  return raw && typeof raw === 'object' ? (raw as LicenseTransitionContext) : {}
}

/** Source when the caller did not declare one: the acting user decides; no user = server/system code. */
export const deriveTransitionSource = (req: PayloadRequest): TransitionSource => {
  const declared = readContext(req).source
  if (declared !== undefined) {
    if (!isOneOf(TRANSITION_SOURCES, declared)) throw new Error('license transition: unknown source')
    return declared
  }
  const user = req.user as ({ _strategy?: string } & PayloadRequest['user']) | null | undefined
  if (isStaffUser(user)) return user._strategy === 'api-key' ? 'mcp' : 'admin'
  return 'system'
}

/**
 * Appends one status log row. Must run inside the transaction that changes the status: pass the same `req`
 * so the insert joins it. The database adapter leaves rollback to the operation that owns the transaction.
 */
export async function recordLicenseTransition(req: PayloadRequest, input: LicenseTransitionInput): Promise<void> {
  if (!Number.isInteger(input.license)) throw new Error('license transition: license id required')
  if (!isOneOf(LICENSE_STATUSES, input.from) || !isOneOf(LICENSE_STATUSES, input.to)) throw new Error('license transition: unknown status')
  if (input.from === input.to) throw new Error('license transition: status unchanged')
  if (!isOneOf(TRANSITION_SOURCES, input.source)) throw new Error('license transition: unknown source')
  if (input.reason !== undefined && !isOneOf(LICENSE_STATUS_REASONS, input.reason)) throw new Error('license transition: unknown reason')
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 500)) throw new Error('license transition: note too long')
  await requireLicenseTransaction(req)
  try {
    await req.payload.db.create({
      collection: 'license-status-log',
      returning: false,
      req,
      data: {
        license: input.license,
        from: input.from,
        to: input.to,
        reason: input.reason ?? null,
        source: input.source,
        actorUser: input.actorUser ?? null,
        order: input.order ?? null,
        event: input.event ?? null,
        ruleKey: input.ruleKey ?? null,
        note: input.note ?? null,
        at: input.at ?? new Date().toISOString(),
        revertOf: input.revertOf ?? null,
        revertible: input.revertible ?? input.source === 'rule',
      },
    })
  } catch {
    // Adapter errors can include SQL bind values, including the audit note.
    throw new APIError('Could not write license status history.', 500)
  }
}

async function requireLicenseTransaction(req: PayloadRequest): Promise<void> {
  const id = await req.transactionID
  if (id == null || !req.payload.db.sessions?.[id]) throw new APIError('License status changes require an active transaction.', 500)
}

/** Stamp the summary from server context before the update and ignore submitted metadata. */
export const stampLicenseTransition: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const next = { ...data }
  delete next.statusChangedAt
  delete next.statusSource
  delete next.statusReason
  if (operation !== 'update' || !originalDoc || next.status == null || next.status === originalDoc.status) return next
  await requireLicenseTransaction(req)
  const context = readContext(req)
  const source = deriveTransitionSource(req)
  const now = new Date()
  if (source === 'rule') {
    const { ruleKey } = context
    if (originalDoc.status !== 'active' || next.status !== 'suspended' || !isOneOf(LICENSING_RULE_KEYS, ruleKey)) {
      throw new APIError('Invalid automatic license transition.', 409, null, true)
    }
    const { rules } = await req.payload.db.findGlobal<Pick<LicensingSetting, 'rules'>>({ slug: 'licensing-settings', req })
    const observeUntil = rules?.observeUntil
    const deadline = typeof observeUntil === 'string' ? Date.parse(observeUntil) : NaN
    if (rules?.[ruleKey]?.mode !== 'suspend' || !(deadline < now.getTime()) || new Date(deadline).toISOString() !== observeUntil) {
      throw new APIError('Automatic license suspension is in monitor-only mode.', 409, null, true)
    }
  }
  const reason = context.reason ?? (source === 'admin' || source === 'mcp' ? 'manual' : undefined)
  return {
    ...next,
    statusChangedAt: now.toISOString(),
    // `customer` is only a log source; on the license it is summarised as `system` (server-side portal action).
    statusSource: isOneOf(LICENSE_STATUS_SOURCES, source) ? source : 'system',
    statusReason: reason ?? null,
  }
}

/** afterChange: write the log row inside the same operation transaction. */
export const logLicenseTransition: CollectionAfterChangeHook = async ({ data, doc, previousDoc, operation, req }) => {
  // Payload projects the response before afterChange. The stamped write data is independent of select/depth.
  if (operation !== 'update' || !previousDoc || typeof data.statusChangedAt !== 'string') return doc
  const context = readContext(req)
  const user = req.user
  await recordLicenseTransition(req, {
    ...context,
    license: previousDoc.id as number,
    from: previousDoc.status as LicenseStatus,
    to: data.status as LicenseStatus,
    source: deriveTransitionSource(req),
    reason: (data.statusReason ?? undefined) as LicenseStatusReason | undefined,
    actorUser: context.actorUser ?? (isStaffUser(user) && isAdminUser(user) ? (user.id as number) : undefined),
    at: data.statusChangedAt,
  })
  return doc
}
