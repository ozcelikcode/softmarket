import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { requestIP } from '@/lib/forms/security'
import { canonicalRequest, canonicalResponse } from '@/lib/licensing/crypto/canonical'
import { hashDeviceFingerprint, hmacSha256, licensingHmacKey, verifyHmacSha256 } from '@/lib/licensing/crypto/hmac'
import { ipPrivacy, normalizeIp, truncateIp } from '@/lib/licensing/crypto/ip'
import { buildLeaseClaims, signLease, verifyLease } from '@/lib/licensing/crypto/jws'
import {
  canVerifyWithKey, decodeBase64Url, deviceKeyThumbprint, ed25519PublicMetadata, ed25519Signer, importEd25519PrivateKey,
  importEd25519PublicKey, SIGNING_KEY_OVERLAP_MS, verifyEd25519,
} from '@/lib/licensing/crypto/keys'

import published from '../../docs/licensing/test-vectors.json'

const vectors = [
  {
    seed: '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
    public: 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    message: '',
    signature: 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
  },
  {
    seed: '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb',
    public: '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c',
    message: '72',
    signature: '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00',
  },
]

const fixtureKey = (seed: string) => createPrivateKey({
  format: 'der', type: 'pkcs8', key: Buffer.from('302e020100300506032b657004220420' + seed, 'hex'),
})
const privateKey = fixtureKey(vectors[0]!.seed)
const metadata = ed25519PublicMetadata(privateKey)
const signer = ed25519Signer(metadata.kid, privateKey)
const now = 1794960000
const nonce = 'AAECAwQFBgcICQoLDA0ODw'
const identity = {
  iss: 'https://licensing.example.com',
  aud: 'studio-pro',
  sub: 'act_' + '1'.repeat(24),
  lid: 'lic_' + '2'.repeat(24),
  fp: Buffer.alloc(32, 15).toString('base64url'),
  dkt: deviceKeyThumbprint(metadata.publicKey)!,
}
const leaseInput = { ...identity, ctr: nonce, sku: 'PRO', seats: 1 }
const leaseOptions = { now, leaseDays: 14, refreshHours: 24 }
const claims = buildLeaseClaims(leaseInput, leaseOptions)
const options = { keys: [metadata], expected: identity, now }
const token = signLease(claims, signer)
const [header, payload, signature] = token.split('.') as [string, string, string]
const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const headerData = { alg: 'EdDSA', kid: metadata.kid, typ: 'sm-lease+jwt' }
const signed = (encodedHeader: string, encodedPayload = payload) => {
  const input = `${encodedHeader}.${encodedPayload}`
  return `${input}.${signer.sign(Buffer.from(input)).toString('base64url')}`
}

describe('Ed25519 fixed vectors and key formats', () => {
  it.each(vectors.map((vector, index) => ({ vector, number: index + 1 })))('matches RFC 8032 §7.1 vector $number', ({ vector }) => {
    const key = fixtureKey(vector.seed)
    const x = Buffer.from(vector.public, 'hex').toString('base64url')
    const message = Buffer.from(vector.message, 'hex')
    const signature = Buffer.from(vector.signature, 'hex')
    const metadata = ed25519PublicMetadata(key)
    expect(metadata.publicKey).toBe(x)
    expect(ed25519Signer(metadata.kid, key).sign(message)).toEqual(signature)
    expect(verifyEd25519(importEd25519PublicKey(x)!, message, signature)).toBe(true)
  })

  it('matches RFC 8037 A.4/A.5 compact signing bytes without relaxing the lease header', () => {
    const input = 'eyJhbGciOiJFZERTQSJ9.RXhhbXBsZSBvZiBFZDI1NTE5IHNpZ25pbmc'
    const signature = 'hgyY0il_MGCjP0JzlnLWG1PPOt7-09PGcvMg3AIbQR6dWbhijcNR4ki4iylGjg5BhVsPt9g7sVvpAr_MuM0KAg'
    expect(signer.sign(Buffer.from(input)).toString('base64url')).toBe(signature)
    expect(verifyEd25519(importEd25519PublicKey(metadata.publicKey)!, Buffer.from(input), Buffer.from(signature, 'base64url'))).toBe(true)
    expect(verifyLease(`${input}.${signature}`, options)).toBeNull()
  })

  it('rejects small-order and noncanonical public keys and other key types', () => {
    for (const y of [Buffer.alloc(32), Buffer.from('01' + '00'.repeat(31), 'hex'), Buffer.alloc(32, 255)]) {
      for (const sign of [0, 128]) {
        y[31] = (y[31]! & 127) | sign
        const x = y.toString('base64url')
        expect(importEd25519PublicKey(x)).toBeNull()
        expect(deviceKeyThumbprint(x)).toBeNull()
        const supplied = createPublicKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', x } })
        expect(verifyEd25519(supplied, Buffer.alloc(0), Buffer.alloc(64))).toBe(false)
      }
    }
    const other = generateKeyPairSync('x25519').publicKey
    expect(verifyEd25519(other, Buffer.alloc(0), Buffer.alloc(64))).toBe(false)
  })

  it('accepts Ed25519 PKCS#8 only and rejects trailing DER bytes', () => {
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
    const der = privateKey.export({ format: 'der', type: 'pkcs8' })
    expect(ed25519PublicMetadata(importEd25519PrivateKey(pem)!)).toEqual(metadata)
    expect(ed25519PublicMetadata(importEd25519PrivateKey(pem.replaceAll('\n', '\\n'))!)).toEqual(metadata)
    expect(ed25519PublicMetadata(importEd25519PrivateKey(der.toString('base64url'))!)).toEqual(metadata)
    expect(importEd25519PrivateKey(Buffer.concat([der, Buffer.of(0)]).toString('base64url'))).toBeNull()
    const other = generateKeyPairSync('ed448').privateKey.export({ format: 'der', type: 'pkcs8' })
    expect(importEd25519PrivateKey(other.toString('base64url'))).toBeNull()
    expect(importEd25519PublicKey(metadata.publicKey + '=')).toBeNull()
  })
})

describe('request and response signing strings', () => {
  const body = Buffer.from('{"x":"é"}\n')
  const request = { method: 'POST', path: '/api/v1/licensing/validate', timestamp: now, nonce, activation: leaseInput.sub, body }

  it('matches fixed vectors, hashing raw UTF-8 and retaining the nonce', () => {
    const hash = '6acb398a579fc7334e02f1d702e5798d768397fe8658c8b528d17e23eca75b39'
    expect(canonicalRequest(request).toString('utf8')).toBe(
      'SM1-REQ\nPOST\n/api/v1/licensing/validate\n1794960000\nAAECAwQFBgcICQoLDA0ODw\nact_111111111111111111111111\n' + hash,
    )
    const response = canonicalResponse({ status: 200, nonce, body })
    expect(canonicalRequest({ ...request, timestamp: String(now) })).toEqual(canonicalRequest(request))
    expect(response.toString()).toBe('SM1-RES\n200\nAAECAwQFBgcICQoLDA0ODw\n' + hash)
    expect(canonicalResponse({ status: 503, body: Buffer.alloc(0) }).toString()).toBe(
      'SM1-RES\n503\n-\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(canonicalRequest({ ...request, path: '/api/v1/licensing/activate', activation: '-' }).toString()).toContain('\n-\n')
    const signature = signer.sign(response)
    const key = importEd25519PublicKey(metadata.publicKey)!
    expect(verifyEd25519(key, response, signature)).toBe(true)
    expect(verifyEd25519(key, canonicalResponse({ status: 200, body }), signature)).toBe(false)
  })

  it('keeps the published client vectors identical to the L2 fixtures', () => {
    const requestBytes = canonicalRequest(request)
    const responseBytes = canonicalResponse({ status: 200, nonce, body })
    const wire = (bytes: Buffer) => ({
      bodyUtf8: body.toString('utf8'),
      canonical: bytes.toString('utf8'),
      signature: signer.sign(bytes).toString('base64url'),
    })
    expect(published.signingKey).toEqual(metadata)
    expect(published.request).toEqual({
      method: request.method, path: request.path, timestamp: request.timestamp, nonce: request.nonce,
      activation: request.activation, devicePublicKey: metadata.publicKey, ...wire(requestBytes),
    })
    expect(published.response).toEqual({ status: 200, nonce, ...wire(responseBytes) })
    expect(published.lease).toEqual({ now, expected: identity, token, claims })
  })

  it('rejects delimiters, query strings and malformed header values', () => {
    expect(() => canonicalRequest({ ...request, path: '/validate?x=1' })).toThrow('invalid_canonical_request')
    expect(() => canonicalRequest({ ...request, method: 'POST\nGET' })).toThrow('invalid_canonical_request')
    for (const fields of [
      { method: ['POST'] }, { path: ['/validate'] }, { path: '/café' }, { path: '/validate\n' },
      { timestamp: -0 }, { nonce: '' }, { activation: '' }, { body: 'body' }, { body: Buffer.alloc(8193) },
    ]) expect(() => canonicalRequest({ ...request, ...fields } as typeof request)).toThrow('invalid_canonical_request')
    for (const invalid of ['', '-']) expect(() => canonicalResponse({ status: 200, nonce: invalid, body })).toThrow()
    expect(() => canonicalRequest({ ...request, timestamp: 1.5 })).toThrow('invalid_canonical_request')
    for (const timestamp of ['01', '+1', '1.0', '1e0', ' 1', '1\n', '', '9007199254740993']) {
      expect(() => canonicalRequest({ ...request, timestamp })).toThrow('invalid_canonical_request')
    }
    expect(() => canonicalRequest({ ...request, activation: 'act_1' })).toThrow('invalid_canonical_request')
    expect(() => canonicalResponse({ status: 200, nonce: nonce + '=', body })).toThrow('invalid_canonical_response')
  })
})

describe('v1 lease JWS', () => {
  it('builds and verifies all claims, clips the offline limit and enforces time boundaries', () => {
    expect(verifyLease(token, options)).toEqual({
      ...leaseInput, iat: now, nbf: now, exp: now + 14 * 86400, rfa: now + 86400, lexp: null, st: 'active', v: 1,
    })
    const end = new Date((now + 1800) * 1000 + 999)
    const clipped = buildLeaseClaims(leaseInput, { ...leaseOptions, licenseExpiresAt: end })
    expect(clipped).toMatchObject({ exp: now + 1800, rfa: now + 86400, lexp: end.toISOString() })
    expect(verifyLease(signLease(clipped, signer), { ...options, now: now + 1800 })).toBeNull()
    expect(verifyLease(token, { ...options, now: now - 1 })).toBeNull()
    expect(verifyLease(token, { ...options, now: claims.exp - 1 })).toEqual(claims)
    expect(() => buildLeaseClaims(leaseInput, { ...leaseOptions, leaseDays: 31 })).toThrow('invalid_lease')
    expect(() => buildLeaseClaims(leaseInput, { ...leaseOptions, licenseExpiresAt: new Date(now * 1000) })).toThrow('invalid_lease')
  })

  it('rejects the wrong issuer, audience, fingerprint and device key', () => {
    for (const expected of [
      { ...identity, iss: 'https://elsewhere.example' },
      { ...identity, aud: 'other-product' },
      { ...identity, sub: 'act_' + '3'.repeat(24) },
      { ...identity, lid: 'lic_' + '3'.repeat(24) },
      { ...identity, fp: identity.dkt },
      { ...identity, dkt: identity.fp },
    ]) expect(verifyLease(token, { ...options, expected })).toBeNull()
  })

  it('rejects wrong signatures, unknown and ambiguous kids, and revocations from either source', () => {
    const corrupt = Buffer.from(signature, 'base64url')
    corrupt[0] = corrupt[0]! ^ 1
    expect(verifyLease(`${header}.${payload}.${corrupt.toString('base64url')}`, options)).toBeNull()
    expect(verifyLease(signed(encoded({ ...headerData, kid: 'unknown' })), options)).toBeNull()
    expect(() => ed25519Signer('alias', privateKey)).toThrow('invalid_signing_key')
    expect(verifyLease(signed(encoded({ ...headerData, kid: 'alias' })), {
      ...options, keys: [{ ...metadata, kid: 'alias' }],
    })).toBeNull()
    expect(verifyLease(token, { ...options, keys: [metadata, metadata] })).toBeNull()
    expect(verifyLease(token, { ...options, keys: [{ ...metadata, revokedAt: new Date(now * 1000).toISOString() }] })).toBeNull()
    expect(verifyLease(token, { ...options, revokedKids: [metadata.kid] })).toBeNull()
    const retiredKey = { ...metadata, retiredAt: new Date(now * 1000).toISOString() }
    expect(verifyLease(token, { ...options, keys: [retiredKey], now: now + 1 })).toEqual(claims)
    const earlierRetirement = { ...metadata, retiredAt: new Date(now * 1000 - 1000).toISOString() }
    expect(verifyLease(token, { ...options, keys: [earlierRetirement] })).toBeNull()
    const deadline = now * 1000 + SIGNING_KEY_OVERLAP_MS
    expect(canVerifyWithKey(retiredKey, deadline - 1)).toBe(true)
    expect(canVerifyWithKey(retiredKey, deadline)).toBe(false)
  })

  it('rejects signed algorithm substitutions and unsupported headers', () => {
    for (const bad of [
      { ...headerData, alg: 'none' }, { ...headerData, alg: 'HS256' }, { ...headerData, alg: 'Ed25519' },
      { ...headerData, kid: '../key' }, { ...headerData, kid: 'a'.repeat(65) },
      { ...headerData, ['__proto__']: {} }, { ...headerData, b64: true },
      { ...headerData, typ: 'JWT' }, { ...headerData, crit: ['b64'], b64: false },
      { ...headerData, jwk: { x: metadata.publicKey } }, { ...headerData, kid: '' }, { alg: 'EdDSA', typ: 'sm-lease+jwt' },
    ]) expect(verifyLease(signed(encoded(bad)), options)).toBeNull()
    const duplicate = Buffer.from(JSON.stringify(headerData).replace('{"alg"', '{"alg":"none","alg"')).toString('base64url')
    expect(verifyLease(signed(duplicate), options)).toBeNull()
  })

  it('rejects invalid JSON, malformed base64url, non-zero pad bits, repeated segments and trailing data', () => {
    const last = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(signature.at(-1)!)
    const noncanonical = signature.slice(0, -1) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[last + 1]
    expect(Buffer.from(noncanonical, 'base64url')).toEqual(Buffer.from(signature, 'base64url'))
    expect(decodeBase64Url(noncanonical)).toBeNull()
    for (const value of [
      token + '.', token + ' xyz', token + '\n', token + 'A', token + '=', token + '🔥', 'a'.repeat(4097), '',
      signed(header + '='), signed(header, 'not+base64'), signed(header, 'a'),
      signed(header, Buffer.from(JSON.stringify(claims) + '{}').toString('base64url')),
      signed(Buffer.from(JSON.stringify(headerData) + '\n').toString('base64url')),
      signed(header, Buffer.from(JSON.stringify(claims).replace('{"iss"', '{"iss":"different","iss"')).toString('base64url')),
      signed(header, Buffer.from('['.repeat(750) + ']'.repeat(750)).toString('base64url')),
      signed(header, encoded({ ...claims, ['__proto__']: {} })),
      signed(header, Buffer.of(0xc3, 0x28).toString('base64url')),
      `${header}.${payload}.${noncanonical}`,
    ]) expect(verifyLease(value, options)).toBeNull()
  })

  it('rejects signed invalid claims', () => {
    for (const invalid of [
      { ...claims, st: 'revoked' }, { ...claims, v: 2 }, { ...claims, exp: claims.iat + 31 * 86400 },
      { ...claims, exp: claims.iat }, { ...claims, nbf: claims.iat + 1 }, { ...claims, iat: 2 ** 53 },
      { ...claims, publicId: 7 }, { ...claims, seats: 0 }, { ...claims, ctr: '' },
      { ...claims, lexp: new Date((now + 10) * 1000).toISOString() },
    ]) expect(verifyLease(signed(header, encoded(invalid)), options)).toBeNull()
  })
})

describe('HMAC and IP privacy', () => {
  const env = { SOFTMARKET_SECRETS_KEY: Buffer.from(Array.from({ length: 32 }, (_, i) => i)).toString('base64url') }
  const date = new Date('2026-11-18T00:00:00Z')

  it('matches independently computed HKDF/HMAC vectors and checks a fixed-width tag', () => {
    const key = licensingHmacKey('fingerprint', env)!
    expect(key.toString('hex')).toBe('d53d1dda418ecc4117a3b65b14dfc90398ad5cc6c306f69b04334ca41a651f55')
    expect(licensingHmacKey('download', env)!.toString('hex')).toBe('f94eef2f40c03d70b3a56bb18a0d40bf502d20c9e00d46a70ca2efcd36b26328')
    expect(licensingHmacKey('ip', env, date)!.toString('hex')).toBe('f509db171c6e5e5363b844e780bc48cf8ac595066442a8ebe6d3814733875c9a')
    const tag = 'km4vlDEXOHpIK8nX0St4J8RIun-L1qxqIW8QS__6cc8'
    expect(hmacSha256(key, '192.0.2.129')).toBe(tag)
    expect(verifyHmacSha256(key, '192.0.2.129', tag)).toBe(true)
    expect(verifyHmacSha256(key, '192.0.2.128', tag)).toBe(false)
    expect(verifyHmacSha256(key, '192.0.2.129', tag + '=')).toBe(false)
    expect(verifyHmacSha256(key, '192.0.2.129', 'AA')).toBe(false)
    expect(licensingHmacKey('download', {})).toBeNull()
    expect(hashDeviceFingerprint(identity.fp, env)).toBe('bd50b58e9995499a035e5e56f6d3a410a7a3a8773d2586d99db6f3906694d92a')
    expect(hashDeviceFingerprint(identity.fp + '=', env)).toBeNull()
    expect(hashDeviceFingerprint(identity.fp, {})).toBeNull()
  })

  it.each([
    ['192.0.2.129', '192.0.2.129', '192.0.2.0/24'],
    ['::FFFF:c000:0281', '192.0.2.129', '192.0.2.0/24'],
    ['0:0:0:0:0:FFFF:192.0.2.129', '192.0.2.129', '192.0.2.0/24'],
    ['2001:0DB8:0012:ABCD:0000:0000:F00D:0001', '2001:db8:12:abcd::f00d:1', '2001:db8:12::/48'],
    ['2001:db8:12:abcd:1:2:3:4', '2001:db8:12:abcd:1:2:3:4', '2001:db8:12::/48'],
    ['2001::1', '2001::1', '2001::/48'],
    ['::1', '::1', '::/48'],
    ['::ffff:1', '::ffff:1', '::/48'],
  ])('normalizes %s and truncates at the family-specific prefix', (input, normalized, prefix) => {
    expect(normalizeIp(input)).toBe(normalized)
    expect(truncateIp(input)).toBe(prefix)
  })

  it('accepts only authenticated proxy addresses for privacy processing', () => {
    const secret = 'test-proxy-secret'.repeat(3)
    const headers = new Headers({ 'x-forwarded-for': '203.0.113.9', 'x-softmarket-client-ip': '::ffff:192.0.2.129' })
    expect(ipPrivacy(requestIP(headers, secret), env, date)).toBeNull()
    headers.set('x-softmarket-proxy-secret', secret)
    expect(ipPrivacy(requestIP(headers, secret), env, date)).toEqual(ipPrivacy('192.0.2.129', env, date))
    headers.delete('x-softmarket-client-ip')
    expect(ipPrivacy(requestIP(headers, secret), env, date)).toBeNull()
  })

  it('rotates at the UTC month boundary and rejects non-address input', () => {
    const first = ipPrivacy('192.0.2.129', env, date)
    expect(first).toEqual({ prefix: '192.0.2.0/24', hash: 'Bcm10G2ttDRHxn0L_84k3B7IRotdeW9PWRJUR7NPCkg' })
    expect(ipPrivacy('::ffff:192.0.2.129', env, date)).toEqual(first)
    expect(ipPrivacy('192.0.2.129', env, new Date('2026-11-30T23:59:59.999Z'))).toEqual(first)
    expect(ipPrivacy('192.0.2.129', env, new Date('2026-12-01T00:00:00.000Z'))?.hash).not.toBe(first?.hash)
    expect(ipPrivacy('192.0.2.130', env, date)?.hash).not.toBe(first?.hash)
    expect(ipPrivacy('192.0.2.129', {}, date)).toEqual({ prefix: '192.0.2.0/24', hash: null })
    for (const invalid of ['unknown', '192.0.2.129, 192.0.2.1', '192.0.02.129', 'fe80::1%en0', '[::1]', '192.0.2.129:80']) {
      expect(ipPrivacy(invalid, env, date)).toBeNull()
    }
    expect(deviceKeyThumbprint(metadata.publicKey)).toBe(createHash('sha256').update(Buffer.from(vectors[0]!.public, 'hex')).digest('base64url'))
  })
})
