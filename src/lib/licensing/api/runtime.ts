import type { Payload } from 'payload'

import { requestIP } from '@/lib/forms/security'
import type { LicensingSetting } from '@/payload-types'
import { createBlocksCache } from '../blocks-cache'
import { ipPrivacy } from '../crypto/ip'
import { createObservationWriter } from '../events/writer'
import { createLicensingLimiter } from '../rate-limit'
import { failure } from './respond'

function createRuntime(payload: Payload) {
  return {
    limit: createLicensingLimiter(),
    observeLimit: createLicensingLimiter(10_000, false),
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

export function clientNetwork(headers: Headers, now: Date) {
  const address = requestIP(headers)
  const ip = ipPrivacy(address, process.env, now)
  return { address, prefix: ip?.prefix ?? null, ip }
}

export async function trafficRejection(
  { limit, blocks, observations }: Runtime, limits: LicensingSetting['limits'],
  network: ReturnType<typeof clientNetwork>, now: Date,
) {
  const { ip, prefix } = network
  await blocks.load()
  if (blocks.matches(now, network)) {
    observations.emit({ type: 'api.blocked_request', now, ip })
    return failure('blocked', now)
  }
  const globalRetry = limit('global', limits.globalPerSecond, 1000)
  if (globalRetry) {
    observations.emit({ type: 'api.rate_limited', severity: 'critical', now, action: 'throttled' })
    return failure('unavailable', now, { retryAfter: globalRetry })
  }
  const retryAfter = limit(`prefix:${prefix ?? 'unknown'}`, limits.ipPrefixPerMinute, 60_000)
  if (retryAfter) {
    observations.emit({ type: 'api.rate_limited', now, ip, action: 'throttled' })
    return failure('rate_limited', now, { retryAfter })
  }
  return null
}
