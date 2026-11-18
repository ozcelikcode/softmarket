import { sql } from '@payloadcms/db-sqlite'
import { BlockList, isIP } from 'node:net'
import type { Payload } from 'payload'

import { withPaymentTransaction } from '@/lib/payments/store/transaction'
import { normalizeIp } from './crypto/ip'
import type { SecurityBlock } from '@/payload-types'

type Block = Pick<SecurityBlock, 'kind' | 'value'> & { expires_at: string | null }
type Network = { address: string; prefix: string | null }
type Device = { license?: number; activation?: number; publicId?: string; licensePublicId?: string; fingerprint?: string }

function networkMatches(cidr: string, address: string): boolean {
  const [base, bits, extra] = cidr.split('/')
  const family = base && isIP(base)
  if (!family || !bits || extra !== undefined || !/^\d{1,3}$/.test(bits) || Number(bits) > (family === 4 ? 32 : 128)) return false
  const ip = normalizeIp(address)
  if (ip === null || isIP(ip) !== family) return false
  const list = new BlockList()
  const kind = family === 4 ? 'ipv4' : 'ipv6'
  list.addSubnet(base, Number(bits), kind)
  return list.check(ip, kind)
}

export function createBlocksCache(payload: Payload) {
  let blocks: Block[] = []
  let expiration = 0
  let pending: Promise<void> | undefined
  let revision = 0

  async function load() {
    if (performance.now() < expiration) return
    if (!pending) {
      const version = revision
      pending = payload.db.drizzle.all<Block>(sql`
        SELECT kind, value, expires_at FROM security_blocks
        WHERE active = 1 AND scope IN ('api', 'all')
        AND (expires_at IS NULL OR expires_at > ${new Date().toISOString()})
      `).then((rows) => {
        // A new automatic block may have been committed while the old snapshot was being read.
        if (version !== revision) return
        blocks = rows
        expiration = performance.now() + 30_000
      }).finally(() => { pending = undefined })
    }
    await pending
  }

  function matches(now: Date, network?: Network, device?: Device): boolean {
    return blocks.some(({ expires_at, kind, value }) => {
      if (expires_at != null && !(Date.parse(expires_at) > now.getTime())) return false
      switch (kind) {
        case 'ip_prefix': return value === network?.prefix
        case 'cidr': return network ? networkMatches(value, network.address) : false
        case 'fingerprint': return value === device?.fingerprint
        case 'activation': return device?.activation !== undefined && (
          value === String(device.activation) || value === device.publicId || value === `act_${device.publicId}`
        )
        case 'license': return device?.license !== undefined && (
          value === String(device.license) || value === device.licensePublicId || value === `lic_${device.licensePublicId}`
        )
      }
    })
  }

  async function blockPrefix(prefix: string, now: Date, firstHours: number, repeatHours: number): Promise<void> {
    const at = now.toISOString()
    const expires = await withPaymentTransaction(payload, async (tx) => {
      const [existing] = await tx.all<Block & { created_at: string; active: number }>(sql`
        SELECT kind, value, expires_at, created_at, active FROM security_blocks
        WHERE kind = 'ip_prefix' AND value = ${prefix} AND scope = 'api' AND source = 'rule'
        ORDER BY created_at DESC, id DESC LIMIT 1
      `)
      if (existing?.active === 1 && existing.expires_at && existing.expires_at > at) return existing.expires_at
      const repeat = existing && Date.parse(existing.created_at) >= now.getTime() - 86_400_000
      const expiresAt = new Date(now.getTime() + (repeat ? repeatHours : firstHours) * 3_600_000).toISOString()
      await tx.run(sql`INSERT INTO security_blocks (kind, value, scope, active, expires_at, source, reason, created_at, updated_at)
        VALUES ('ip_prefix', ${prefix}, 'api', 1, ${expiresAt}, 'rule', 'invalid_license', ${at}, ${at})`)
      return expiresAt
    }, {
      confirm: async (expiresAt) => Boolean((await payload.db.drizzle.all(sql`SELECT 1 FROM security_blocks
        WHERE kind = 'ip_prefix' AND value = ${prefix} AND source = 'rule' AND active = 1 AND expires_at = ${expiresAt} LIMIT 1`))[0]),
    })
    revision++
    if (!blocks.some((block) => block.kind === 'ip_prefix' && block.value === prefix && block.expires_at === expires)) {
      blocks = [...blocks, { kind: 'ip_prefix', value: prefix, expires_at: expires }]
    }
    expiration = 0
  }

  return { load, matches, blockPrefix }
}
