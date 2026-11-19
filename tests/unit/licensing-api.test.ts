import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { parseClientBody, readBoundedBody, signedHeaders } from '@/lib/licensing/api/guard'
import { failure, respond } from '@/lib/licensing/api/respond'
import { runtimeFor } from '@/lib/licensing/api/runtime'
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

  it('refills active budgets without resetting them during sustained overflow', () => {
    const limit = createLicensingLimiter(2)
    expect(limit('A', 2, 4000, 0)).toBe(0)
    expect(limit('A', 2, 4000, 0)).toBe(0)
    expect(limit('A', 2, 4000, 0)).toBe(2)
    expect(limit('B', 1, 10_000, 0)).toBe(0)
    expect(limit('A', 2, 4000, 2000)).toBe(0)
    expect(limit('C', 2, 4000, 2000)).toBe(0)
    expect(limit('A', 2, 4000, 2000)).toBe(2)
    expect(limit('B', 1, 10_000, 2000)).toBe(8)
    expect(limit('D', 2, 4000, 2000)).toBe(0)
    expect(limit('E', 2, 4000, 2000)).toBe(2)
    expect(limit('E', 2, 4000, 10_000)).toBe(0)
  })

  it('does not attribute overflow observations to an untracked subject', () => {
    const observe = createLicensingLimiter(1, true)
    expect(observe('tracked', 1, 60_000, 0)).toBe(0)
    expect(observe('new', 1, 60_000, 0)).toBe(0)
    expect(observe('new', 1, 60_000, 0)).toBe(0)
    expect(observe('tracked', 1, 60_000, 0)).toBe(60)
  })

  it('prefix churn cannot evict the global, activation or license buckets', () => {
    const { globalLimit, prefixLimit, activationLimit, licenseLimit } = runtimeFor({} as Payload)
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    try {
      expect(globalLimit(1)).toBe(0)
      expect(activationLimit('activation', 1, 60_000)).toBe(0)
      expect(licenseLimit('license', 1, 60_000)).toBe(0)
      for (let i = 0; i <= 10_000; i++) {
        if (prefixLimit(`prefix-${i}`, 1, 60_000)) throw new Error(`Prefix ${i} was denied`)
      }
      expect(prefixLimit('untracked', 1, 60_000)).toBe(60)
      expect(prefixLimit('prefix-0', 1, 60_000)).toBe(60)
      expect(globalLimit(1)).toBe(1)
      expect(activationLimit('activation', 1, 60_000)).toBe(60)
      expect(licenseLimit('license', 1, 60_000)).toBe(60)
    } finally {
      clock.mockRestore()
    }
  })
})
