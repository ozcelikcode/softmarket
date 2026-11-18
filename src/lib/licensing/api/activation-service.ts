import { sql } from '@payloadcms/db-sqlite'
import { randomBytes } from 'node:crypto'
import type { Payload } from 'payload'

import { normalizeLicenseKey } from '@/lib/licenses/generate'
import { withPaymentTransaction, type PaymentTx } from '@/lib/payments/store/transaction'
import type { LicensingSetting } from '@/payload-types'
import type { createBlocksCache } from '../blocks-cache'
import { hashDeviceFingerprint, licensingHmacKey } from '../crypto/hmac'
import { buildLeaseClaims, signLease } from '../crypto/jws'
import { deviceKeyThumbprint, type Ed25519Signer } from '../crypto/keys'
import type { createObservationWriter, Observation } from '../events/writer'
import { generatePublicId } from '../public-id'
import type { createLicensingLimiter } from '../rate-limit'
import { findDownload, updates } from './download-catalog'
import { openDownloadFile } from './download-file'
import { downloadGrants } from './download-tokens'
import { apiAvailable, eligibilityFields, entitlementError, licenseError, licenseTables, type LicenseEligibility } from './entitlement'
import type { ClientBody, Endpoint, SignedHeaders } from './guard'
import { claimNonce, confirmedNonces, equalText, isDeactivationRetry, nonceReceipt, requestDigest, type NonceReceipt } from './nonce'
import { failure, unixSeconds, type Result } from './respond'
import { enqueueClientRead, type ClientWorkResult } from './validation-queue'

type License = LicenseEligibility & {
  id: number; publicId: string; key: string | null; customer: number; product: number
  productCode: string; sku: string; seats: number | null; maxDevices: number | null
}
type Device = {
  id: number; publicId: string; license: number; customer: number | null; product: number | null; status: string
  fingerprintHash: string; key: string; thumbprint: string; counter: string | null; prevCounter: string | null
  lastSeenAt: string | null; endReason: string | null
}
export type ClientOperation = { [E in Endpoint]: { endpoint: E; body: ClientBody<E> } }[Endpoint]
export type ClientContext = {
  payload: Payload; settings: LicensingSetting; signer: Ed25519Signer; issuer: string
  headers: SignedHeaders; key: string; now: () => Date
  ip: Observation['ip']; country: string | null; networkBlocked: (now: Date) => boolean
  observations: ReturnType<typeof createObservationWriter>; blocks: ReturnType<typeof createBlocksCache>
  limit: ReturnType<typeof createLicensingLimiter>; observeLimit: ReturnType<typeof createLicensingLimiter>
}

const deviceFields = sql`id, public_id AS publicId, license_id AS license, customer_id AS customer, product_id AS product,
  status, fingerprint_hash AS fingerprintHash, device_public_key AS key, device_key_thumbprint AS thumbprint,
  counter, prev_counter AS prevCounter, last_seen_at AS lastSeenAt, end_reason AS endReason`
const licenseFields = sql`${eligibilityFields}, l.id, l.public_id AS publicId, l.customer_id AS customer, l.product_id AS product,
  p.licensing_code AS productCode, e.sku, l.seats, l.max_devices AS maxDevices`

const newCounter = () => randomBytes(16).toString('base64url')
const deactivated = { status: 200, body: { deactivated: true } }
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export async function readDeviceKey(payload: Payload, activation: string): Promise<string | null> {
  return (await payload.db.drizzle.all<{ key: string }>(sql`SELECT device_public_key AS key FROM license_activations
    WHERE public_id = ${activation.slice(4)}`))[0]?.key ?? null
}

function leaseFor(context: ClientContext, license: License, sub: string, fingerprint: string, thumbprint: string, ctr: string, now: Date) {
  const claims = buildLeaseClaims({
    iss: context.issuer, aud: license.productCode, sub,
    lid: `lic_${license.publicId}`, sku: license.sku, seats: deviceLimit(license),
    fp: fingerprint, dkt: thumbprint, ctr,
  }, {
    now: unixSeconds(now), leaseDays: context.settings.leaseDays, refreshHours: context.settings.refreshHours,
    licenseExpiresAt: license.expiresAt ? new Date(license.expiresAt) : null,
  })
  return { lease: signLease(claims, context.signer), refreshAfter: claims.rfa, serverTime: claims.iat }
}

function deviceLimit(license: License) {
  const limit = license.maxDevices ?? license.seats
  if (limit === null || !Number.isSafeInteger(limit) || limit < 1) throw new Error('invalid_device_limit')
  return limit
}

type Emit = (event: Omit<Observation, 'now' | 'ip'>) => void

// Omit labels or other optional metadata that resemble pasted credentials or network addresses.
function safeMetadata(value: string | undefined): string | null {
  if (!value || /[@:]/.test(value) || /[A-Za-z0-9_-]{43}/.test(value)
    || /(?:[a-z\d]{5}[-_\s\u2010-\u2015]+){4}[a-z\d]{5}/i.test(value)
    || /(?:\d{1,3}\.){3}\d{1,3}/.test(value)) return null
  return value
}

async function activate(
  tx: PaymentTx, context: ClientContext, license: License, body: ClientBody<'activate'>,
  now: Date, emit: Emit, fingerprint: string, existing: Device | undefined,
): Promise<Result> {
  const thumbprint = deviceKeyThumbprint(body.devicePublicKey)
  if (!thumbprint) return failure('invalid_signature', now)
  const subject = { license: license.id, customer: license.customer }
  const denied = licenseError(license, now)
  if (denied) return failure(denied, now)
  if (existing && (existing.customer !== license.customer || existing.product !== license.product)) {
    return failure('invalid_license', now)
  }
  if (existing && equalText(body.devicePublicKey, existing.key)) {
    const activationId = `act_${existing.publicId}`
    if (!existing.counter) throw new Error('missing_device_counter')
    return { status: 200, body: { activationId, ...leaseFor(context, license, activationId, body.fingerprint, thumbprint, existing.counter, now) } }
  }

  const [{ used }] = await tx.all<{ used: number }>(sql`SELECT count(*) AS used FROM license_activations
    WHERE license_id = ${license.id} AND status = 'active'`) as [{ used: number }]
  const max = deviceLimit(license)
  if (!existing && used >= max) {
    emit({ type: 'activation.seat_limit', ...subject })
    return failure('seat_limit', now, { seats: { used, max } })
  }
  const [otherDevice] = await tx.all(sql`SELECT 1 FROM license_activations
    WHERE device_key_thumbprint = ${thumbprint} AND status = 'active'`)
  if (otherDevice) return failure('invalid_license', now)

  const at = now.toISOString()
  if (existing) {
    const [{ used: rebinds }] = await tx.all<{ used: number }>(sql`SELECT count(*) AS used FROM license_activations
      WHERE license_id = ${license.id} AND end_reason = 'rebind'
      AND ended_at > ${new Date(now.getTime() - 30 * DAY_MS).toISOString()}`) as [{ used: number }]
    if (rebinds >= context.settings.selfService.rebindsPer30Days) return failure('rebind_limit', now)
    if ((await tx.run(sql`UPDATE license_activations SET status = 'deactivated', end_reason = 'rebind',
      ended_at = ${at}, updated_at = ${at} WHERE id = ${existing.id} AND status = 'active'`)) !== 1) {
      throw new Error('activation_conflict')
    }
  }
  const publicId = generatePublicId()
  const activationId = `act_${publicId}`
  const ctr = newCounter()
  const [device] = await tx.all<{ id: number }>(sql`INSERT INTO license_activations
    (public_id, license_id, customer_id, product_id, status, device_public_key, device_key_thumbprint, fingerprint_hash,
      device_label, platform, arch, app_version, counter, activated_at, last_seen_at, last_ip_prefix, last_ip_hash,
      last_country, created_at, updated_at)
    VALUES (${publicId}, ${license.id}, ${license.customer}, ${license.product}, 'active', ${body.devicePublicKey},
      ${thumbprint}, ${fingerprint}, ${safeMetadata(body.deviceLabel)}, ${body.platform}, ${safeMetadata(body.arch)},
      ${safeMetadata(body.appVersion)}, ${ctr}, ${at}, ${at}, ${context.ip?.prefix ?? null}, ${context.ip?.hash ?? null},
      ${context.country}, ${at}, ${at}) RETURNING id`)
  if (!device) throw new Error('activation_failed')
  emit({ type: existing ? 'activation.rebind' : 'activation.created', ...subject, activation: device.id })
  return { status: 200, body: { activationId, ...leaseFor(context, license, activationId, body.fingerprint, thumbprint, ctr, now) } }
}

async function validate(
  tx: PaymentTx, context: ClientContext, license: License, device: Device, body: ClientBody<'validate'>,
  now: Date, emit: Emit,
): Promise<Result> {
  const fingerprint = hashDeviceFingerprint(body.fingerprint)
  if (!fingerprint || !equalText(fingerprint, device.fingerprintHash)) return failure('invalid_signature', now)
  const denied = entitlementError(license, device.status, now)
  if (denied) return failure(denied, now)
  const subject = { license: license.id, customer: license.customer, activation: device.id }
  const rule = context.settings.rules.cloneSuspected
  const currentCounter = equalText(body.ctr, device.counter)
  const previousCounter = equalText(body.ctr, device.prevCounter)
  if (rule.mode !== 'off' && !currentCounter && !previousCounter) {
    const repeat = context.observeLimit(`clone:${device.id}`, rule.threshold, rule.windowHours * HOUR_MS)
    emit({ type: 'activation.clone_suspected', ...subject, severity: repeat ? 'high' : 'low' })
  }
  const at = now.toISOString()
  const ctr = newCounter()
  if ((await tx.run(sql`UPDATE license_activations SET counter = ${ctr}, prev_counter = counter
    WHERE id = ${device.id} AND status = 'active'`)) !== 1) throw new Error('activation_conflict')

  const intervalMs = context.settings.seenWriteMinutes * 60_000
  if (!device.lastSeenAt || !(Date.parse(device.lastSeenAt) > now.getTime() - intervalMs)) {
    tx.afterCommit(() => context.observations.touch({
      id: device.id, at, intervalMs, ip: context.ip, country: context.country, version: safeMetadata(body.appVersion),
    }))
  }
  return { status: 200, body: leaseFor(context, license, context.headers.activation, body.fingerprint, device.thumbprint, ctr, now) }
}

export async function executeClientOperation(context: ClientContext, operation: ClientOperation): Promise<Result> {
  const receipt = nonceReceipt()
  const { payload, headers, settings } = context
  const normalized = operation.endpoint === 'activate' ? normalizeLicenseKey(operation.body.licenseKey) : undefined
  const activationWhere = operation.endpoint === 'activate' ? sql`
    l.key = ${normalized} AND p.licensing_code = ${operation.body.productCode} AND p.licensing_enabled = 1 AND c._verified = 1
  ` : undefined
  const fingerprint = operation.endpoint === 'activate' ? hashDeviceFingerprint(operation.body.fingerprint) : null
  if (activationWhere) {
    // Wrong keys, product mismatches, unverified customers and per-license throttles never enter the writer queue.
    const now = context.now()
    if (!fingerprint) return failure('unavailable', now)
    const [target] = await payload.db.drizzle.all<{ id: number }>(sql`
      SELECT l.id FROM ${licenseTables} WHERE ${activationWhere}`)
    if (!target) return { ...failure('invalid_license', now), unknownLicense: true }
    const retryAfter = context.limit(`license:${target.id}`, settings.limits.activationsPerLicensePerDay, DAY_MS)
    if (retryAfter) {
      context.observations.emit({ type: 'activation.burst', license: target.id, action: 'throttled', now, ip: context.ip, country: context.country })
      return failure('rate_limited', now, { retryAfter })
    }
  }
  const work = async (tx: PaymentTx, recordReceipt: (receipt: NonceReceipt) => void): Promise<ClientWorkResult> => {
    const now = context.now()
    const at = now.toISOString()
    const endpoint = operation.endpoint
    const emit: Emit = (event) => tx.afterCommit(() => context.observations.emit({ ...event, now, ip: context.ip, country: context.country }))
    if (Math.abs(unixSeconds(now) - headers.timestamp) > settings.clockSkewSeconds) {
      emit({ type: 'api.clock_skew' })
      return failure('clock_skew', now)
    }
    if (context.networkBlocked(now)) {
      emit({ type: 'api.blocked_request' })
      return failure('blocked', now)
    }
    if (!await apiAvailable(tx, context.signer.kid)) return failure('unavailable', now)

    const device = operation.endpoint === 'activate' ? null : (await tx.all<Device>(sql`
      SELECT ${deviceFields} FROM license_activations WHERE public_id = ${headers.activation.slice(4)}
    `))[0]
    if (endpoint !== 'activate' && (!device || !equalText(context.key, device.key))) return failure('invalid_signature', now)
    const [license] = await tx.all<License>(sql`SELECT ${licenseFields}, ${activationWhere ? sql`l.key` : sql`NULL`} AS key FROM ${licenseTables}
      WHERE ${activationWhere ?? sql`l.id = ${device!.license}`}`)
    if (!license || (normalized !== undefined && !equalText(normalized, license.key))) {
      return { ...failure('invalid_license', now), unknownLicense: true }
    }
    if (device && (device.customer !== license.customer || device.product !== license.product)) {
      return failure('invalid_signature', now)
    }
    const existing = fingerprint === null ? undefined : (await tx.all<Device>(sql`
      SELECT ${deviceFields} FROM license_activations
      WHERE license_id = ${license.id} AND fingerprint_hash = ${fingerprint} AND status = 'active'
    `))[0]
    const bound = device ?? existing
    if (context.blocks.matches(now, undefined, {
      license: license.id, licensePublicId: license.publicId, activation: bound?.id,
      publicId: bound?.publicId, fingerprint: device?.fingerprintHash ?? fingerprint ?? undefined,
    })) {
      emit({ type: 'api.blocked_request', license: license.id, activation: bound?.id })
      return failure('blocked', now)
    }

    const canDeactivate = operation.endpoint === 'deactivate' && device && license.status !== 'revoked'
      && (device.status === 'active' || (device.status === 'deactivated' && device.endReason === 'user'))
    const claimed = await claimNonce(tx, {
      endpoint, nonce: headers.nonce, at, receipt,
      deactivationDigest: canDeactivate ? requestDigest(headers) : undefined,
    })
    if (!claimed) {
      if (endpoint === 'deactivate' && await isDeactivationRetry(tx, headers)) return deactivated
      emit({ type: 'api.replay', license: license.id, activation: device?.id })
      return failure('invalid_signature', now)
    }
    recordReceipt({ nonce: headers.nonce, receipt })

    switch (operation.endpoint) {
      case 'activate':
        return activate(tx, context, license, operation.body, now, emit, fingerprint!, existing)
      case 'validate':
        if (license.enabled !== 1 || license.verified !== 1) return failure('invalid_license', now)
        return validate(tx, context, license, device!, operation.body, now, emit)
      case 'updates':
      case 'downloads/link': {
        const denied = entitlementError(license, device!.status, now)
        if (denied) return failure(denied, now)
        if (operation.endpoint === 'updates') return { status: 200, body: await updates(tx, license.product, operation.body, now) }
        const download = await findDownload(tx, operation.body.downloadId, license.product, now)
        if (!download) return failure('download_unavailable', now)
        // Filesystem checks stay outside the SQLite writer lock and follow the confirmed nonce commit.
        return {
          finish: async () => {
            const key = licensingHmacKey('download')
            if (!key) return failure('unavailable', context.now())
            const file = await openDownloadFile(download.filename)
            if (!file) return failure('download_unavailable', context.now())
            await file.handle.close()
            const issuedAt = context.now()
            const body = downloadGrants(payload).issue(key, {
              file: download, etag: file.etag, activation: headers.activation, license: license.publicId, product: license.product,
            }, issuedAt)
            if (!body) return failure('unavailable', issuedAt, { retryAfter: 1 })
            context.observations.emit({
              type: 'download.link_issued', now: issuedAt, ip: context.ip, country: context.country,
              activation: device!.id, license: license.id, customer: license.customer,
            })
            return { status: 200, body }
          },
        }
      }
      case 'deactivate': {
        if (!canDeactivate) return failure(license.status === 'revoked' ? 'license_revoked' : 'activation_revoked', now)
        if (device!.status === 'active') {
          const changed = await tx.run(sql`UPDATE license_activations SET status = 'deactivated', end_reason = 'user',
            ended_at = ${at}, end_nonce = ${headers.nonce}, updated_at = ${at}
            WHERE id = ${device!.id} AND status = 'active'`)
          if (changed !== 1) throw new Error('activation_conflict')
          emit({ type: 'activation.ended', license: license.id, customer: license.customer, activation: device!.id })
        }
        return deactivated
      }
    }
  }
  if (operation.endpoint !== 'activate' && operation.endpoint !== 'deactivate') {
    const result = await enqueueClientRead(payload, work)
    return 'finish' in result ? result.finish() : result
  }
  const receipts: NonceReceipt[] = []
  const result = await withPaymentTransaction(payload, (tx) => work(tx, (receipt) => { receipts.push(receipt) }), {
    confirm: () => confirmedNonces(payload, receipts),
  })
  if ('finish' in result) throw new Error('unexpected_client_work')
  return result
}
