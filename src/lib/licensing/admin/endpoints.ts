import type { PayloadRequest } from 'payload'

import { requestIP } from '@/lib/forms/security'
import { guardAdminSession } from '@/lib/payments/admin-endpoints'
import { truncateIp } from '../crypto/ip'
import { recordDeniedAdminAction } from './denied-audit'
import {
  BLOCK_DURATIONS_HOURS,
  createBlock,
  deactivateActivation,
  liftBlock,
  reactivateLicense,
  restoreLicense,
  revokeLicense,
  rotateSigningKey,
  suspendLicense,
  triageEvent,
  type ActionResult,
  type AdminActor,
  type BlockKindInput,
  type ExpectedLicenseState,
} from './actions'

/*
 * L6b admin action endpoints (plan §5.4). Payload collection/global endpoints, so they share Payload's auth:
 *   POST /api/licenses/:id/{suspend,revoke,restore,reactivate}
 *   POST /api/license-activations/:id/deactivate                 { mode: release|revoke }
 *   POST /api/security-events/:id/{acknowledge,resolve,false-positive}   (false-positive: optional restore: true)
 *   POST /api/security-events/:id/block                          { kind: ip_prefix|activation|fingerprint|license }
 *   POST /api/security-blocks/add                                { kind, value | activation | license }
 *   POST /api/security-blocks/:id/lift
 *   POST /api/globals/licensing-settings/rotate-signing-key      { confirm: "DÖNDÜR" | "ROTATE" }
 *
 * Access = an admin's PANEL SESSION only (guardAdminSession, the P6 matrix): anonymous 401; customer, editor,
 * users API key (and therefore MCP), a JWT in an Authorization header and cross-site requests 403. In addition the body
 * must be `application/json` (a cross-site form post cannot send it without a CORS preflight) and at most 2 KiB.
 * Body: { requestId (idempotency key, 16-64 [A-Za-z0-9_-]), reason (3-500 chars, mandatory), note? (<= 500),
 *         expected? { status, changedAt } (license actions: optimistic concurrency, 409 `stale`),
 *         expectedTriage? (events), confirm? (revoke: last 6 chars of the license public ID; rotation: typed word) }.
 * Responses are `no-store` JSON `{ code, replayed?, ...publicData }` with short codes; logs carry codes and numeric ids
 * only (never the reason/note text, a key, an e-mail or an address).
 * Refusals of an identified caller (403/404/409/415/4xx validation) write one coalesced `denied` security-audit row
 * (./denied-audit.ts); anonymous 401s and successful or replayed actions write none.
 */

export type LicensingAdminRoute =
  | 'license.suspend' | 'license.revoke' | 'license.restore' | 'license.reactivate'
  | 'activation.deactivate'
  | 'event.acknowledge' | 'event.resolve' | 'event.false-positive' | 'event.block'
  | 'block.add' | 'block.lift'
  | 'signing-key.rotate'

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })

const MAX_BODY = 2048
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

type Body = Record<string, unknown>
class BadInput extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

function text(body: Body, key: string, { min = 0, max = 500, required = false } = {}): string | undefined {
  const raw = body[key]
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new BadInput(`${key}_required`)
    return undefined
  }
  if (typeof raw !== 'string') throw new BadInput(`invalid_${key}`)
  const value = raw.trim().normalize('NFC')
  if (CONTROL_RE.test(value) || value.length > max) throw new BadInput(`invalid_${key}`)
  if (value.length < min) throw new BadInput(required ? `${key}_required` : `invalid_${key}`)
  return value || undefined
}

function expectedState(body: Body): ExpectedLicenseState {
  const raw = body.expected as { status?: unknown; changedAt?: unknown } | undefined
  if (!raw || typeof raw !== 'object' || typeof raw.status !== 'string' || raw.status.length > 20) throw new BadInput('expected_required')
  if (raw.changedAt !== null && (typeof raw.changedAt !== 'string' || raw.changedAt.length > 40 || !Number.isFinite(Date.parse(raw.changedAt)))) {
    throw new BadInput('expected_required')
  }
  return { status: raw.status, changedAt: raw.changedAt as string | null }
}

const oneOf = <T extends string>(body: Body, key: string, values: readonly T[], fallback?: T): T => {
  const value = body[key] ?? fallback
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) throw new BadInput(`invalid_${key}`)
  return value as T
}

const positiveId = (value: unknown, code: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new BadInput(code)
  return value
}

function duration(body: Body): (typeof BLOCK_DURATIONS_HOURS)[number] | null {
  const value = body.durationHours
  if (value === null) return null
  if (typeof value === 'number' && (BLOCK_DURATIONS_HOURS as readonly number[]).includes(value)) return value as (typeof BLOCK_DURATIONS_HOURS)[number]
  throw new BadInput('invalid_durationHours')
}

function actorOf(req: PayloadRequest, id: number): AdminActor {
  const address = requestIP(req.headers)
  return { id, address: address === 'unknown' ? null : address, ipPrefix: address === 'unknown' ? null : truncateIp(address) }
}

/** Streaming 2 KiB cap (own copy: the payment body reader is a P4 webhook module and stays payment-only). */
async function readSmallBody(request: Request): Promise<{ ok: true; text: string } | { ok: false; reason: 'too_large' | 'malformed' }> {
  const declared = request.headers.get('content-length')
  if (declared && /^\d+$/.test(declared.trim()) && Number(declared.trim()) > MAX_BODY) {
    await request.body?.cancel().catch(() => undefined)
    return { ok: false, reason: 'too_large' }
  }
  if (!request.body) return { ok: true, text: '' }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)) }
  } catch {
    return { ok: false, reason: 'malformed' }
  } finally {
    reader.releaseLock()
  }
}

const ROUTES_WITHOUT_ID: readonly LicensingAdminRoute[] = ['block.add', 'signing-key.rotate']

/** Test seam: `env` reaches the signing key service (rotation) only. */
export async function handleLicensingAdminAction(
  req: PayloadRequest,
  route: LicensingAdminRoute,
  options: { env?: Record<string, string | undefined>; now?: () => Date } = {},
): Promise<Response> {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const rawRouteId = ROUTES_WITHOUT_ID.includes(route) ? '' : String((req.routeParams as { id?: unknown } | undefined)?.id ?? '')
  const targetId = /^[1-9]\d{0,11}$/.test(rawRouteId) ? Number(rawRouteId) : undefined
  /** Refusal of an identified caller: audited (`denied`, coalesced) and answered with the fixed code. */
  const deny = async (status: number, code: string) => {
    await recordDeniedAdminAction(req, { route, code, http: status, targetId, now: options.now?.() })
    return json(status, { code })
  }
  const guard = guardAdminSession(req)
  if (!guard.ok) {
    // Anonymous 401s stay unaudited here (rate-limited elsewhere); any identified caller is audited.
    if (req.user && guard.response.status !== 401) {
      const code = String(((await guard.response.clone().json().catch(() => ({}))) as { code?: unknown }).code ?? 'forbidden')
      return deny(guard.response.status, code)
    }
    return guard.response
  }
  if (req.headers.has('authorization')) return deny(403, 'panel_session_required')
  const origin = req.headers.get('origin') ?? ''
  try {
    if (new URL(origin).origin !== origin) return deny(403, 'cross_origin')
  } catch {
    return deny(403, 'cross_origin')
  }
  const actorId = Number(guard.actor.id)
  if (!Number.isSafeInteger(actorId) || actorId < 1) return deny(403, 'forbidden')

  let id = 0
  if (!ROUTES_WITHOUT_ID.includes(route)) {
    if (targetId === undefined) return deny(404, 'not_found')
    id = targetId
  }
  const type = (req.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (type !== 'application/json') return deny(415, 'json_required')
  const raw = await readSmallBody(req as unknown as Request)
  if (!raw.ok) return deny(raw.reason === 'too_large' ? 413 : 400, raw.reason)
  let body: Body
  try {
    const parsed = JSON.parse(raw.text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return deny(400, 'malformed')
    body = parsed as Body
  } catch {
    return deny(400, 'malformed')
  }

  let result: ActionResult
  try {
    const requestId = body.requestId
    if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) throw new BadInput('invalid_requestId')
    const common = {
      actor: actorOf(req, actorId), requestId,
      reason: text(body, 'reason', { min: 3, required: true })!,
      note: text(body, 'note'),
      now: options.now?.(),
    }
    const { payload } = req
    switch (route) {
      case 'license.suspend':
        result = await suspendLicense(payload, { ...common, license: id, expected: expectedState(body) })
        break
      case 'license.revoke':
        result = await revokeLicense(payload, { ...common, license: id, expected: expectedState(body), confirm: text(body, 'confirm', { max: 40, required: true })! })
        break
      case 'license.restore':
        result = await restoreLicense(payload, { ...common, license: id, expected: expectedState(body) })
        break
      case 'license.reactivate':
        result = await reactivateLicense(payload, { ...common, license: id, expected: expectedState(body) })
        break
      case 'activation.deactivate':
        result = await deactivateActivation(payload, { ...common, activation: id, mode: oneOf(body, 'mode', ['release', 'revoke'] as const) })
        break
      case 'event.acknowledge':
      case 'event.resolve':
      case 'event.false-positive': {
        const action = route.slice('event.'.length) as 'acknowledge' | 'resolve' | 'false-positive'
        if (body.restore !== undefined && typeof body.restore !== 'boolean') throw new BadInput('invalid_restore')
        result = await triageEvent(payload, {
          ...common, event: id, action, restore: action === 'false-positive' && body.restore === true,
          expectedTriage: oneOf(body, 'expectedTriage', ['open', 'acknowledged', 'resolved', 'false_positive'] as const),
        })
        break
      }
      case 'event.block':
        result = await createBlock(payload, {
          ...common, event: id, kind: oneOf(body, 'kind', ['ip_prefix', 'activation', 'fingerprint', 'license'] as const),
          scope: oneOf(body, 'scope', ['api', 'all'] as const, 'api'), durationHours: duration(body), confirmSelf: body.confirmSelf === true,
        })
        break
      case 'block.add': {
        const kind = oneOf<BlockKindInput>(body, 'kind', ['ip_prefix', 'cidr', 'activation', 'fingerprint', 'license'])
        result = await createBlock(payload, {
          ...common, kind,
          ...(kind === 'ip_prefix' || kind === 'cidr' ? { value: text(body, 'value', { max: 64, required: true }) } : {}),
          ...(kind === 'activation' || kind === 'fingerprint' ? { activation: positiveId(body.activation, 'invalid_activation') } : {}),
          ...(kind === 'license' ? { license: positiveId(body.license, 'invalid_license') } : {}),
          scope: oneOf(body, 'scope', ['api', 'all'] as const, 'api'), durationHours: duration(body), confirmSelf: body.confirmSelf === true,
        })
        break
      }
      case 'block.lift':
        result = await liftBlock(payload, { ...common, block: id })
        break
      case 'signing-key.rotate':
        result = await rotateSigningKey(payload, { ...common, confirm: text(body, 'confirm', { max: 20, required: true })!, ...(options.env ? { env: options.env } : {}) })
        break
    }
  } catch (error) {
    if (error instanceof BadInput) return deny(400, error.code)
    req.payload.logger.error(`licensing admin action failed action=${route} target=${id} code=${error instanceof Error ? error.name : 'error'}`)
    return json(500, { code: 'internal' })
  }
  if (result.http >= 400 && result.http < 500) await recordDeniedAdminAction(req, { route, code: result.code, http: result.http, targetId, now: options.now?.() })
  req.payload.logger.info(`licensing admin action=${route} target=${id} code=${result.code} by=${actorId}`)
  return json(result.http, { code: result.code, ...(result.replayed ? { replayed: true } : {}), ...(result.data ?? {}) })
}
