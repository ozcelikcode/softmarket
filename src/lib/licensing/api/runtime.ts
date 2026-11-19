import type { Payload } from 'payload'

import { requestIP } from '@/lib/forms/security'
import type { LicensingSetting } from '@/payload-types'
import { createBlocksCache } from '../blocks-cache'
import { ipPrivacy } from '../crypto/ip'
import { createObservationWriter } from '../events/writer'
import { createLicensingLimiter } from '../rate-limit'
import { failure } from './respond'

function createRuntime(payload: Payload) {
  const global = createLicensingLimiter(1)
  return {
    globalLimit: (perSecond: number) => global('global', perSecond, 1000),
    prefixLimit: createLicensingLimiter(),
    activationLimit: createLicensingLimiter(),
    licenseLimit: createLicensingLimiter(),
    badSignatureLimit: createLicensingLimiter(10_000, true),
    invalidLicenseLimit: createLicensingLimiter(10_000, true),
    cloneLimit: createLicensingLimiter(10_000, true),
    blocks: createBlocksCache(payload),
    observations: createObservationWriter(payload),
  }
}

type Runtime = ReturnType<typeof createRuntime>
const shared = globalThis as typeof globalThis & { smLicensingApi?: WeakMap<Payload, Runtime> }
const runtimes = shared.smLicensingApi ??= new WeakMap<Payload, Runtime>()

export function runtimeFor(payload: Payload): Runtime {
  let runtime = runtimes.get(payload)
  if (!runtime) {
    runtime = createRuntime(payload)
    runtimes.set(payload, runtime)
  }
  return runtime
}

/** L6b: an admin block change takes effect on the next API request of this process (no runtime is created here). */
export function invalidateLicensingBlocks(payload: Payload): void {
  runtimes.get(payload)?.blocks.invalidate()
}

export function clientNetwork(headers: Headers, now: Date) {
  const address = requestIP(headers)
  const ip = ipPrivacy(address, process.env, now)
  return { address, prefix: ip?.prefix ?? null, ip }
}

export async function trafficRejection(
  { globalLimit, prefixLimit, blocks, observations }: Runtime, limits: LicensingSetting['limits'],
  network: ReturnType<typeof clientNetwork>, now: Date,
) {
  const { ip, prefix } = network
  await blocks.load()
  if (blocks.matches(now, network)) {
    observations.emit({ type: 'api.blocked_request', now, ip })
    return failure('blocked', now)
  }
  const globalRetry = globalLimit(limits.globalPerSecond)
  if (globalRetry) {
    observations.emit({ type: 'api.rate_limited', severity: 'critical', now, action: 'throttled' })
    return failure('unavailable', now, { retryAfter: globalRetry })
  }
  const retryAfter = prefixLimit(prefix ?? 'unknown', limits.ipPrefixPerMinute, 60_000)
  if (retryAfter) {
    observations.emit({ type: 'api.rate_limited', now, ip, action: 'throttled' })
    return failure('rate_limited', now, { retryAfter })
  }
  return null
}
