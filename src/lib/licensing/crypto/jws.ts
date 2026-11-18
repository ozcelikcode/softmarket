// Server only. Compact JWS for the v1 lease profile. There is no algorithm negotiation.
import { z } from 'zod/mini'

import { LICENSING_CODE_RE, MAX_LEASE_DAYS } from '../constants'
import { isPublicId } from '../public-id'
import {
  canVerifyWithKey, decodeBase64Url, deviceKeyThumbprint, importEd25519PublicKey, KEY_ID_RE, verifyEd25519,
  type Ed25519Signer, type SigningKeyMetadata,
} from './keys'

const MAX_TOKEN_LENGTH = 4096
const SECONDS_PER_DAY = 86400
const MAX_REFRESH_SECONDS = 168 * 3600
const TYPE = 'sm-lease+jwt'

const headerSchema = z.strictObject({ alg: z.literal('EdDSA'), kid: z.string().check(z.regex(KEY_ID_RE)), typ: z.literal(TYPE) })
const jwtTime = z.int().check(z.nonnegative(), z.maximum(253402300799)) // Last second of year 9999.
const encoded = (bytes: number) => z.string().check(z.refine((value) => decodeBase64Url(value, bytes) !== null))
const publicId = (prefix: 'act_' | 'lic_') =>
  z.string().check(z.refine((value) => value.startsWith(prefix) && isPublicId(value.slice(prefix.length))))
const leaseSchema = z.strictObject({
  iss: z.string().check(z.refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && value === url.origin
    } catch {
      return false
    }
  })),
  aud: z.string().check(z.regex(LICENSING_CODE_RE)),
  sub: publicId('act_'),
  lid: publicId('lic_'),
  sku: z.string().check(z.minLength(1)),
  seats: z.int().check(z.positive()),
  fp: encoded(32),
  dkt: encoded(32),
  iat: jwtTime,
  nbf: jwtTime,
  exp: jwtTime,
  rfa: jwtTime,
  lexp: z.nullable(z.iso.datetime({ offset: true })),
  ctr: encoded(16),
  st: z.literal('active'),
  v: z.literal(1),
})

export type LeaseClaims = z.infer<typeof leaseSchema>
type LeaseIdentity = Pick<LeaseClaims, 'iss' | 'aud' | 'sub' | 'lid' | 'fp' | 'dkt'>

function validTimes({ iat, nbf, exp, rfa, lexp }: LeaseClaims): boolean {
  const lifetime = exp - iat
  const refresh = rfa - iat
  return nbf === iat && lifetime > 0 && lifetime <= MAX_LEASE_DAYS * SECONDS_PER_DAY
    && refresh >= 3600 && refresh <= MAX_REFRESH_SECONDS && refresh % 3600 === 0
    && (lexp === null || exp <= Math.floor(Date.parse(lexp) / 1000))
}

/** The caller grants a lease only after checking current license and activation state. Times are Unix seconds. */
export function buildLeaseClaims(
  input: Omit<LeaseClaims, 'iat' | 'nbf' | 'exp' | 'rfa' | 'lexp' | 'st' | 'v'>,
  { now, leaseDays, refreshHours, licenseExpiresAt = null }: {
    now: number; leaseDays: number; refreshHours: number; licenseExpiresAt?: Date | null
  },
): LeaseClaims {
  if (!Number.isInteger(leaseDays) || leaseDays < 1 || leaseDays > MAX_LEASE_DAYS) throw new Error('invalid_lease')
  if (licenseExpiresAt && !Number.isFinite(licenseExpiresAt.getTime())) throw new Error('invalid_lease')
  const expires = now + leaseDays * SECONDS_PER_DAY
  const claims = leaseSchema.safeParse({
    ...input,
    iat: now,
    nbf: now,
    exp: licenseExpiresAt ? Math.min(expires, Math.floor(licenseExpiresAt.getTime() / 1000)) : expires,
    rfa: now + refreshHours * 3600,
    lexp: licenseExpiresAt?.toISOString() ?? null,
    st: 'active',
    v: 1,
  })
  if (!claims.success || !validTimes(claims.data)) throw new Error('invalid_lease')
  return claims.data
}

export function signLease(claims: LeaseClaims, signer: Ed25519Signer): string {
  const header = headerSchema.safeParse({ alg: 'EdDSA', kid: signer.kid, typ: TYPE })
  const payload = leaseSchema.safeParse(claims)
  if (!header.success || !payload.success || !validTimes(payload.data)) throw new Error('invalid_lease')
  const signingInput = [header.data, payload.data].map((value) => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.')
  if (signingInput.length + 87 > MAX_TOKEN_LENGTH) throw new Error('invalid_lease')
  const signature = signer.sign(Buffer.from(signingInput, 'ascii'))
  if (signature.byteLength !== 64) throw new Error('invalid_signature')
  return `${signingInput}.${signature.toString('base64url')}`
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Check the compact JSON profile before schema parsing, including duplicate names and trailing JSON data. */
function parseCompactJson(bytes: Buffer): unknown {
  const source = utf8.decode(bytes)
  const data: unknown = JSON.parse(source)
  return JSON.stringify(data) === source ? data : null
}

/** Use pinned verification keys and revocations obtained through the caller's trusted channel. */
export function verifyLease(token: string, options: {
  keys: readonly SigningKeyMetadata[]
  revokedKids?: readonly string[]
  expected: LeaseIdentity
  now: number
}): LeaseClaims | null {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH || !jwtTime.safeParse(options.now).success) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string]
  const header = decodeBase64Url(encodedHeader)
  const payload = decodeBase64Url(encodedPayload)
  const signature = decodeBase64Url(encodedSignature, 64)
  if (!header || !payload || !signature) return null
  try {
    const parsed = headerSchema.safeParse(parseCompactJson(header))
    if (!parsed.success || options.revokedKids?.includes(parsed.data.kid)) return null
    const matches = options.keys.filter(({ kid }) => kid === parsed.data.kid)
    const [pinned] = matches
    if (matches.length !== 1 || !pinned || pinned.kid !== deviceKeyThumbprint(pinned.publicKey)
      || !canVerifyWithKey(pinned, options.now * 1000)) return null
    const publicKey = importEd25519PublicKey(pinned.publicKey)
    const input = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'ascii')
    if (!publicKey || !verifyEd25519(publicKey, input, signature)) return null

    const result = leaseSchema.safeParse(parseCompactJson(payload))
    if (!result.success || !validTimes(result.data)) return null
    const { iss, aud, sub, lid, fp, dkt, iat, nbf, exp } = result.data
    const { expected, now } = options
    const { retiredAt } = pinned
    if (retiredAt != null && iat * 1000 > Date.parse(retiredAt)) return null
    if (iss !== expected.iss || aud !== expected.aud || sub !== expected.sub || lid !== expected.lid
      || fp !== expected.fp || dkt !== expected.dkt || now < nbf || now >= exp) return null
    return result.data
  } catch {
    return null
  }
}
