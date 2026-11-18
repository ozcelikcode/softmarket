import { describe, expect, it } from 'vitest'

import vectors from '../../docs/licensing/test-vectors.json'
import { requestSigningBytes, verifyLease, verifyResponse } from '../../docs/licensing/examples/ts/verify'

const { lease, request, response, signingKey } = vectors
const trust = { keys: [signingKey] }
const signedResponse = { ...response, keyId: signingKey.kid, body: Buffer.from(response.bodyUtf8) }

describe('licensing client reference verifier', () => {
  it('uses the documented raw UTF-8 request and response wire fixtures', () => {
    expect(requestSigningBytes(request.path, request.timestamp, request.nonce, request.activation, Buffer.from(request.bodyUtf8)).toString())
      .toBe(request.canonical)
    expect(verifyResponse(signedResponse, trust, lease.now)).toBe(true)
    expect(verifyResponse({ ...signedResponse, status: 403 }, trust, lease.now)).toBe(false)
    expect(verifyResponse({ ...signedResponse, body: Buffer.from(response.bodyUtf8.trim()) }, trust, lease.now)).toBe(false)
    expect(verifyResponse({ ...signedResponse, nonce: 'AAAAAAAAAAAAAAAAAAAAAA' }, trust, lease.now)).toBe(false)
    expect(verifyResponse({ ...signedResponse, keyId: null }, trust, lease.now)).toBe(false)
    expect(verifyResponse(signedResponse, { ...trust, revokedKids: [signingKey.kid] }, lease.now)).toBe(false)
  })

  it('verifies the pinned lease and enforces binding, time and revocations', () => {
    expect(verifyLease(lease.token, trust, lease.expected, lease.now)).toEqual(lease.claims)
    expect(verifyLease(lease.token, trust, { ...lease.expected, lid: undefined }, lease.now)).toEqual(lease.claims)
    expect(verifyLease(lease.token, trust, { ...lease.expected, fp: lease.expected.dkt }, lease.now)).toBeNull()
    expect(verifyLease(lease.token, trust, lease.expected, lease.now - 1)).toBeNull()
    expect(verifyLease(lease.token, trust, lease.expected, lease.claims.exp)).toBeNull()
    expect(verifyLease(lease.token + '=', trust, lease.expected, lease.now)).toBeNull()
    expect(verifyLease(lease.token, { keys: [signingKey, signingKey] }, lease.expected, lease.now)).toBeNull()
    expect(verifyLease(lease.token, { keys: [{ ...signingKey, revokedAt: new Date().toISOString() }] }, lease.expected, lease.now)).toBeNull()
  })
})
