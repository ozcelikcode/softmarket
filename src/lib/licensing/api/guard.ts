import { z } from 'zod/mini'

import { DEVICE_PLATFORMS, LICENSING_CODE_RE } from '../constants'
import { canonicalRequest } from '../crypto/canonical'
import { decodeBase64Url } from '../crypto/keys'
import { isPublicId } from '../public-id'
import { parseSemver } from './semver'

export const LICENSING_API_PATH = '/api/v1/licensing'
const MAX_BODY_BYTES = 8192
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
const encoded = (bytes: number) => z.string().check(z.refine((value) => decodeBase64Url(value, bytes) !== null))
const version = z.string().check(z.maxLength(32), z.refine((value) => parseSemver(value) !== null))

const releaseChannels = ['stable', 'beta', 'lts'] as const
const downloadOperatingSystems = ['windows', 'macos', 'linux', 'web', 'android', 'ios', 'other'] as const
const downloadArchitectures = ['x64', 'arm64', 'x86', 'universal'] as const
const isDownloadId = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0

const schemas = {
  activate: z.strictObject({
    licenseKey: z.string().check(z.minLength(1), z.maxLength(128)),
    productCode: z.string().check(z.regex(LICENSING_CODE_RE)),
    fingerprint: encoded(32),
    devicePublicKey: encoded(32),
    deviceLabel: z.optional(z.string().check(z.maxLength(64), z.regex(/^[^\p{Cc}]*$/u))),
    platform: z.enum(DEVICE_PLATFORMS),
    arch: z.optional(z.string().check(z.maxLength(32), z.regex(/^[^\p{Cc}]*$/u))),
    appVersion: version,
  }),
  validate: z.strictObject({ ctr: encoded(16), fingerprint: encoded(32), appVersion: version }),
  deactivate: z.strictObject({ reason: z.optional(z.enum(['user', 'uninstall', 'transfer'])) }),
  updates: z.strictObject({
    channel: z.enum(releaseChannels),
    currentVersion: version,
    os: z.enum(downloadOperatingSystems),
    arch: z.optional(z.enum(downloadArchitectures)),
  }),
  'downloads/link': z.strictObject({ downloadId: z.number().check(z.refine(isDownloadId)) }),
}

export type Endpoint = keyof typeof schemas
export type ClientBody<E extends Endpoint> = z.infer<(typeof schemas)[E]>

export async function readBoundedBody(request: Request): Promise<Buffer | null> {
  const length = request.headers.get('content-length')
  if (!request.body || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')
    || (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES))) {
    void request.body?.cancel().catch(() => undefined)
    return null
  }
  const reader = request.body.getReader()
  const bytes = Buffer.allocUnsafe(MAX_BODY_BYTES)
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return Buffer.from(bytes.subarray(0, size))
      if (size + chunk.value.byteLength > MAX_BODY_BYTES) {
        void reader.cancel().catch(() => undefined)
        return null
      }
      bytes.set(chunk.value, size)
      size += chunk.value.byteLength
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }
}

export function parseClientBody<E extends Endpoint>(endpoint: E, body: Buffer): ClientBody<E> | null {
  try {
    const parsed = schemas[endpoint].safeParse(JSON.parse(utf8.decode(body)) as unknown)
    return parsed.success ? parsed.data as ClientBody<E> : null
  } catch {
    return null
  }
}

export function requestNonce(headers: Headers): string | undefined {
  const nonce = headers.get('sm-nonce') ?? ''
  return decodeBase64Url(nonce, 16) ? nonce : undefined
}

export function signedHeaders(request: Request, endpoint: Endpoint, body: Buffer) {
  const timestamp = request.headers.get('sm-timestamp') ?? ''
  const activation = request.headers.get('sm-activation') ?? ''
  const nonce = requestNonce(request.headers)
  if (!nonce || !/^(0|[1-9]\d{0,15})$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp))) return null
  if (endpoint === 'activate' ? activation !== '-' : !activation.startsWith('act_') || !isPublicId(activation.slice(4))) return null
  const path = new URL(request.url).pathname
  if (path !== `${LICENSING_API_PATH}/${endpoint}` || request.method !== 'POST') return null
  return {
    timestamp: Number(timestamp), activation, nonce,
    signature: decodeBase64Url(request.headers.get('sm-signature') ?? '', 64),
    canonical: canonicalRequest({ method: 'POST', path, timestamp, activation, nonce, body }),
  }
}

export type SignedHeaders = NonNullable<ReturnType<typeof signedHeaders>>
