// Server only. The caller selects the address from a trusted request source.
import { isIP } from 'node:net'

import { hmacSha256, licensingHmacKey, type LicensingEnv } from './hmac'

const canonicalV6 = (address: string) => new URL(`http://[${address}]`).hostname.slice(1, -1)

/** Normalize IPv6 to lowercase compressed form and collapse IPv4-mapped IPv6 to dotted IPv4. */
export function normalizeIp(address: string): string | null {
  if (address.includes('%')) return null // A zone identifier is not part of the address.
  const family = isIP(address)
  if (family === 4) return address
  if (family !== 6) return null
  const normalized = canonicalV6(address)
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized)
  if (!mapped) return normalized
  const high = Number.parseInt(mapped[1]!, 16)
  const low = Number.parseInt(mapped[2]!, 16)
  return [high >>> 8, high & 255, low >>> 8, low & 255].join('.')
}

function prefixOf(normalized: string): string {
  if (isIP(normalized) === 4) return `${normalized.slice(0, normalized.lastIndexOf('.'))}.0/24`
  const [left, right] = normalized.split('::')
  const head = left ? left.split(':') : []
  const tail = right ? right.split(':') : []
  const zeros = Array<string>(8 - head.length - tail.length).fill('0')
  const first48 = [...head, ...zeros, ...tail].slice(0, 3).join(':')
  return `${canonicalV6(`${first48}::`)}/48`
}

export function truncateIp(address: string): string | null {
  const normalized = normalizeIp(address)
  return normalized === null ? null : prefixOf(normalized)
}

/** Only the prefix and month-scoped digest are suitable for persistence. No pepper means no digest. */
export function ipPrivacy(address: string, env: LicensingEnv = process.env, now = new Date()): { prefix: string; hash: string | null } | null {
  const normalized = normalizeIp(address)
  if (normalized === null) return null
  const key = licensingHmacKey('ip', env, now)
  return { prefix: prefixOf(normalized), hash: key ? hmacSha256(key, normalized) : null }
}
