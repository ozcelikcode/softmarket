// Server only. Sign the exact bytes from the wire, without JSON reserialization.
import { createHash } from 'node:crypto'

import { isPublicId } from '../public-id'
import { decodeBase64Url } from './keys'

const sha256 = (body: Uint8Array) => createHash('sha256').update(body).digest('hex')

export function canonicalRequest(input: {
  method: string
  path: string
  /** Pass the original header when verifying. Signers may supply integer Unix seconds. */
  timestamp: number | string
  nonce: string
  activation: string
  body: Uint8Array
}): Buffer {
  const { method, path, timestamp, nonce, activation, body } = input
  const seconds = typeof timestamp === 'string' ? Number(timestamp) : timestamp
  const validActivation = activation === '-' || (typeof activation === 'string' && activation.startsWith('act_') && isPublicId(activation.slice(4)))
  if (typeof method !== 'string' || !/^[A-Z]+$/.test(method) || typeof path !== 'string' || !/^\/[\x21-\x7e]*$/.test(path) || /[?#]/.test(path)
    || !Number.isSafeInteger(seconds) || seconds < 0 || Object.is(seconds, -0)
    || (typeof timestamp === 'string' && timestamp !== String(seconds)) || !decodeBase64Url(nonce, 16)
    || !validActivation || !(body instanceof Uint8Array) || body.byteLength > 8192) {
    throw new Error('invalid_canonical_request')
  }
  return Buffer.from(['SM1-REQ', method, path, timestamp, nonce, activation, sha256(body)].join('\n'), 'utf8')
}

export function canonicalResponse(input: { status: number; nonce?: string; body: Uint8Array }): Buffer {
  const { status, nonce, body } = input
  if (!Number.isInteger(status) || status < 100 || status > 599 || (nonce !== undefined && !decodeBase64Url(nonce, 16))
    || !(body instanceof Uint8Array)) {
    throw new Error('invalid_canonical_response')
  }
  return Buffer.from(['SM1-RES', status, nonce ?? '-', sha256(body)].join('\n'), 'utf8')
}
