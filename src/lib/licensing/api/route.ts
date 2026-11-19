import { generateKeyPairSync } from 'node:crypto'
import type { Payload } from 'payload'

import { licensingHmacKey } from '../crypto/hmac'
import { importEd25519PublicKey, verifyEd25519 } from '../crypto/keys'
import { loadLicensingSigner } from '../signing'
import { executeClientOperation, readDeviceKey, type ClientOperation } from './activation-service'
import { parseClientBody, readBoundedBody, requestNonce, signedHeaders, type Endpoint } from './guard'
import { failure, respond, unixSeconds } from './respond'
import { clientNetwork, runtimeFor, trafficRejection } from './runtime'

const HOUR = 3_600_000
const issuerHost = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const dummyKey = generateKeyPairSync('ed25519').publicKey

async function configuration(payload: Payload) {
  const settings = await payload.findGlobal({
    slug: 'licensing-settings', depth: 0, overrideAccess: true,
    select: {
      apiEnabled: true, publicHost: true, clockSkewSeconds: true, leaseDays: true, refreshHours: true,
      seenWriteMinutes: true, limits: true, selfService: true, rules: { cloneSuspected: true }, signingKeys: true, countrySource: true,
    },
  })
  const signer = await loadLicensingSigner(payload, process.env, settings.signingKeys ?? [])
  // The configured issuer is pinned by clients. Incoming Host and forwarded headers are untrusted.
  const issuer = settings.publicHost && issuerHost.test(settings.publicHost) ? `https://${settings.publicHost}` : null
  return { settings, signer, issuer }
}

const shared = globalThis as typeof globalThis & {
  smLicensingConfigs?: WeakMap<Payload, ReturnType<typeof configuration>>
  smLicensingShutdown?: boolean
}
const configs = shared.smLicensingConfigs ??= new WeakMap<Payload, ReturnType<typeof configuration>>()

export function readConfiguration(payload: Payload) {
  const pending = configs.get(payload)
  if (pending) return pending
  // Coalesce concurrent reads while making configuration changes visible to new requests.
  const running = configuration(payload).finally(() => configs.delete(payload))
  configs.set(payload, running)
  return running
}

export type RouteDependencies = { loadPayload: () => Promise<Payload>; now?: () => Date }

export function createLicensingPost(endpoint: Endpoint, { loadPayload, now: clock = () => new Date() }: RouteDependencies) {
  return async (request: Request): Promise<Response> => {
    const nonce = requestNonce(request.headers)
    const now = clock()
    let signer: Awaited<ReturnType<typeof loadLicensingSigner>> = null
    let payload: Payload | undefined
    try {
      payload = await loadPayload()
      const runtime = runtimeFor(payload)
      const { activationLimit, licenseLimit, badSignatureLimit, invalidLicenseLimit, cloneLimit, blocks, observations } = runtime
      const resolved = await readConfiguration(payload)
      const { settings, issuer } = resolved
      signer = resolved.signer
      const deny = (code: Parameters<typeof failure>[0], retryAfter?: number) =>
        respond(failure(code, now, { retryAfter }), now, nonce, signer)
      if (!settings.apiEnabled || !signer || !issuer || !licensingHmacKey('fingerprint')) {
        void request.body?.cancel().catch(() => undefined)
        return deny('unavailable')
      }
      const network = clientNetwork(request.headers, now)
      const { ip, prefix } = network
      const traffic = await trafficRejection(runtime, settings.limits, network, now)
      if (traffic) {
        void request.body?.cancel().catch(() => undefined)
        return respond(traffic, now, nonce, signer)
      }
      const raw = await readBoundedBody(request)
      if (!raw) return deny('bad_request')
      const headers = signedHeaders(request, endpoint, raw)
      if (!headers) return deny('bad_request')
      if (Math.abs(unixSeconds(now) - headers.timestamp) > settings.clockSkewSeconds) {
        observations.emit({ type: 'api.clock_skew', now, ip })
        return deny('clock_skew')
      }

      const body = parseClientBody(endpoint, raw)
      if (!body) return deny('bad_request')
      const operation = { endpoint, body } as ClientOperation
      const key = operation.endpoint === 'activate' ? operation.body.devicePublicKey : await readDeviceKey(payload, headers.activation)
      const publicKey = key && importEd25519PublicKey(key)
      const valid = headers.signature && verifyEd25519(publicKey || dummyKey, headers.canonical, headers.signature)
      if (!key || !publicKey || !valid) {
        // The threshold aggregates claimed activation IDs. It never locks out the named device.
        // Activation requests carry no activation ID ('-'), so they must not share one global bucket.
        const high = endpoint !== 'activate' && key && badSignatureLimit(headers.activation, settings.limits.badSignaturesPerActivationPerHour, HOUR)
        observations.emit({ type: 'api.bad_signature', now, ip, severity: high ? 'high' : 'medium' })
        return deny('invalid_signature')
      }
      if (endpoint !== 'activate' && endpoint !== 'deactivate') {
        const retry = activationLimit(headers.activation, settings.limits.requestsPerActivationPerHour, HOUR)
        if (retry) {
          observations.emit({ type: 'api.rate_limited', now, ip, action: 'throttled' })
          return deny('rate_limited', retry)
        }
      }

      // Only a proxy-authenticated request is trusted, and deploy/Caddyfile deletes client copies of CF-IPCountry;
      // a Cloudflare front end needs the trusted-proxy variant in docs/licensing/operations.md.
      const countryHeader = ip && settings.countrySource === 'cloudflare_header' ? request.headers.get('cf-ipcountry') : null
      const country = countryHeader && /^[A-Z]{2}$/.test(countryHeader) ? countryHeader : null
      const result = await executeClientOperation({
        payload, settings, signer, issuer, headers, now: clock, key, ip, country, observations, blocks,
        limit: licenseLimit, observeLimit: cloneLimit,
        networkBlocked: (at) => blocks.matches(at, network),
      }, operation)
      // Only unknown keys and product mismatches feed the prefix block. A caller that presented a valid key
      // (for example a device key still bound to another active row) must not block its own network.
      if (endpoint === 'activate' && result.unknownLicense) {
        const high = invalidLicenseLimit(prefix ?? 'unknown', settings.limits.invalidLicensePerIpPerHour, HOUR)
        if (high && ip) await blocks.blockPrefix(ip.prefix, now, settings.limits.ipBlockFirstHours, settings.limits.ipBlockRepeatHours)
        observations.emit({ type: 'api.invalid_license', now, ip, severity: high ? 'high' : 'low', action: high && ip ? 'blocked' : undefined })
      }
      return respond(result, clock(), nonce, signer)
    } catch {
      // Never pass request data, SQL bindings or arbitrary error messages to the logger.
      payload?.logger.error('licensing: client request failed')
      const at = clock()
      return respond(failure(signer ? 'internal' : 'unavailable', at), at, nonce, signer)
    }
  }
}

export async function flushLicensingObservations(payload: Payload) {
  await runtimeFor(payload).observations.flush()
}

export async function loadPayload() {
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  const payload = await getPayload({ config })
  if (!shared.smLicensingShutdown) {
    shared.smLicensingShutdown = true
    const flush = () => { void flushLicensingObservations(payload) }
    process.once('beforeExit', flush)
    // Next also handles signals and may exit before this best-effort write finishes.
    process.once('SIGTERM', flush)
  }
  return payload
}

export const licensingPost = (endpoint: Endpoint) => createLicensingPost(endpoint, { loadPayload })
