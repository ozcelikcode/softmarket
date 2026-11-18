import { describe, expect, it } from 'vitest'

import { parseClientBody, readBoundedBody, signedHeaders } from '@/lib/licensing/api/guard'
import { failure, respond } from '@/lib/licensing/api/respond'
import { ed25519PublicMetadata, ed25519Signer } from '@/lib/licensing/crypto/keys'
import { createLicensingLimiter } from '@/lib/licensing/rate-limit'
import { activateBody, makeDevice, signedRequest, verifyResponse } from './helpers/licensing-client'

describe('client API wire contract', () => {
  it('preserves exact bytes and rejects streamed bodies after 8192 bytes', async () => {
    const json = ' {  "reason" : "user" } \r\n'
    const signed = signedRequest('deactivate', json, makeDevice(), { activation: `act_${'1'.repeat(24)}` })
    const raw = await readBoundedBody(signed.request)
    expect(raw?.toString()).toBe(json)
    expect(signedHeaders(signed.request, 'deactivate', raw!)?.nonce).toBe(signed.nonce)
    const body = (chunks: number[]) => new Request('https://test.invalid', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: new ReadableStream({ start(controller) {
        for (const size of chunks) controller.enqueue(new Uint8Array(size))
        controller.close()
      } }),
      duplex: 'half',
    } as RequestInit)
    expect((await readBoundedBody(body([4096, 4096])))?.length).toBe(8192)
    expect(await readBoundedBody(body([4096, 4096, 1]))).toBeNull()
  })

  it.each([
    { appVersion: '1.2' }, { appVersion: '01.2.3' }, { appVersion: '1.2.3-01' },
    { platform: 'ios' }, { deviceLabel: 'control\u0007' }, { fingerprint: 'a'.repeat(43) + '=' },
    { arch: 'x'.repeat(33) }, { surprise: true }, { licenseKey: '' }, { licenseKey: 'A'.repeat(129) },
  ])('rejects invalid activation fields %j', (change) => {
    const valid = { ...activateBody('placeholder', makeDevice()), appVersion: '1.2.3-rc.1+build.3' }
    expect(parseClientBody('activate', Buffer.from(JSON.stringify(valid)))).toEqual(valid)
    expect(parseClientBody('activate', Buffer.from(JSON.stringify({ ...valid, ...change })))).toBeNull()
  })

  it('signs the exact response, HTTP status and request nonce', async () => {
    const { privateKey } = makeDevice()
    const { kid, publicKey } = ed25519PublicMetadata(privateKey)
    const now = new Date()
    const { nonce } = signedRequest('activate', {}, makeDevice())
    const response = respond(failure('rate_limited', now, { retryAfter: 5 }), now, nonce, ed25519Signer(kid, privateKey))
    const raw = await response.text()
    const signature = response.headers.get('SM-Response-Signature')!
    expect(response.headers.get('Retry-After')).toBe('5')
    expect(response.headers.get('SM-Key-Id')).toBe(kid)
    expect(verifyResponse(429, raw, signature, nonce, publicKey)).toBe(true)
    expect(verifyResponse(429, raw, '', nonce, publicKey)).toBe(false)
    expect(verifyResponse(429, raw + ' ', signature, nonce, publicKey)).toBe(false)
    expect(verifyResponse(400, raw, signature, nonce, publicKey)).toBe(false)
    expect(verifyResponse(429, raw, signature, Buffer.alloc(16).toString('base64url'), publicKey)).toBe(false)
  })

  it('refills with a retry interval and cannot evict an active bucket', () => {
    const limit = createLicensingLimiter(1)
    expect(limit('A', 2, 4000, 0)).toBe(0)
    expect(limit('A', 2, 4000, 0)).toBe(0)
    expect(limit('A', 2, 4000, 0)).toBe(2)
    expect(limit('B', 2, 4000, 2000)).toBe(1)
    expect(limit('A', 2, 4000, 2000)).toBe(0)
    expect(limit('B', 2, 4000, 6000)).toBe(0)
  })
})
