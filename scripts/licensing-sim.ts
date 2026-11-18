import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { parseArgs } from 'node:util'

import { requestSigningBytes, thumbprint, verifyLease, verifyResponse, type Trust } from '../docs/licensing/examples/ts/verify'

const usage = `Usage: SOFTMARKET_SIM_LICENSE_KEY=… pnpm licensing:sim \\
  --url https://licensing.example.com --issuer https://licensing.example.com \\
  --product studio-pro --server-key <unpadded-base64url-raw-public-key> \\
  [--channel stable] [--version 0.0.0] [--os linux] [--arch x64] [--download-id 42]
`

type LeaseResponse = { lease: string; refreshAfter: number; serverTime: number }
type Download = { id: number; size: number; sha256?: string }
type Endpoint = 'activate' | 'validate' | 'updates' | 'downloads/link' | 'deactivate'
const api = '/api/v1/licensing/'
const now = () => Math.floor(Date.now() / 1000)

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: 'boolean' }, url: { type: 'string' }, issuer: { type: 'string' },
      product: { type: 'string' }, 'server-key': { type: 'string' },
      channel: { type: 'string', default: 'stable' }, version: { type: 'string', default: '0.0.0' },
      os: { type: 'string', default: 'linux' }, arch: { type: 'string' }, 'download-id': { type: 'string' },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }

  const licenseKey = process.env.SOFTMARKET_SIM_LICENSE_KEY
  const { url, issuer, product, 'server-key': serverKey, channel, version, os, arch, 'download-id': id } = values
  if (!url || !issuer || !product || !serverKey || !licenseKey) throw new Error(usage)
  const base = new URL(url)
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname)
  if ((base.protocol !== 'https:' && !(loopback && base.protocol === 'http:'))
    || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('--url must be an HTTPS origin or a loopback HTTP origin')
  }
  if (new URL(issuer).origin !== issuer || !issuer.startsWith('https://')) throw new Error('--issuer must be the pinned HTTPS origin')
  const pin = Buffer.from(serverKey, 'base64url')
  if (pin.length !== 32 || pin.toString('base64url') !== serverKey) throw new Error('--server-key must encode 32 raw Ed25519 bytes')
  const trust: Trust = { keys: [{ kid: thumbprint(pin), publicKey: serverKey }] }
  const downloadId = id === undefined ? undefined : Number(id)
  if (downloadId !== undefined && (!/^[1-9]\d*$/.test(id!) || !Number.isSafeInteger(downloadId))) {
    throw new Error('--download-id must be a positive safe integer')
  }

  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const devicePublicKey = publicKey.export({ format: 'jwk' }).x!
  const dkt = thumbprint(Buffer.from(devicePublicKey, 'base64url'))
  const fingerprint = createHash('sha256').update(`sm-fp-v1|${product}|`).update(randomBytes(32)).digest('base64url')
  const platform = ['windows', 'macos', 'linux'].includes(os) ? os : 'other'

  async function post<T>(endpoint: Endpoint, input: object, activation: string): Promise<T> {
    const path = api + endpoint
    const body = Buffer.from(JSON.stringify(input))
    const timestamp = now()
    const nonce = randomBytes(16).toString('base64url')
    const response = await fetch(new URL(path, base), {
      method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: {
        'Content-Type': 'application/json', 'SM-Activation': activation, 'SM-Timestamp': String(timestamp),
        'SM-Nonce': nonce, 'SM-Signature': sign(null, requestSigningBytes(path, timestamp, nonce, activation, body), privateKey).toString('base64url'),
      },
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!verifyResponse({
      status: response.status, nonce, body: bytes,
      keyId: response.headers.get('SM-Key-Id'), signature: response.headers.get('SM-Response-Signature'),
    }, trust, now())) throw new Error(`${endpoint}: response signature failed (HTTP ${response.status})`)
    const payload = JSON.parse(bytes.toString('utf8'))
    if (response.status !== 200) {
      const code = payload?.error?.code
      const label = typeof code === 'string' && /^[a-z_]{1,40}$/.test(code) ? code : 'unknown_error'
      throw new Error(`${endpoint}: HTTP ${response.status} ${label}`)
    }
    return payload as T
  }

  function acceptLease(reply: LeaseResponse, sub: string, lid?: string) {
    const lease = verifyLease(reply.lease, trust, { iss: issuer!, aud: product!, sub, lid, fp: fingerprint, dkt }, now())
    if (!lease || lease.iat !== reply.serverTime || lease.rfa !== reply.refreshAfter) throw new Error('Lease verification failed')
    return lease
  }

  const activated = await post<LeaseResponse & { activationId: string }>('activate', {
    licenseKey, productCode: product, fingerprint, devicePublicKey, platform, appVersion: version, ...(arch && { arch }),
  }, '-')
  const firstLease = acceptLease(activated, activated.activationId)
  let completed = false
  try {
    console.log('activate OK')
    const activation = firstLease.sub
    const validated = await post<LeaseResponse>('validate', { ctr: firstLease.ctr, fingerprint, appVersion: version }, activation)
    acceptLease(validated, activation, firstLease.lid)
    console.log('validate OK')

    const { latest } = await post<{ latest: { downloads: Download[] } | null }>('updates', {
      channel, currentVersion: version, os, ...(arch && { arch }),
    }, activation)
    console.log('updates OK')
    const entries = latest?.downloads ?? []
    const selected = downloadId === undefined ? entries[0] : entries.find(({ id }) => id === downloadId)
    const selectedId = downloadId ?? selected?.id
    if (selectedId === undefined) throw new Error('No matching download. Supply a known --download-id or use a catalog with a newer release and matching file.')

    const link = await post<{ url: string; expiresAt: number }>('downloads/link', { downloadId: selectedId }, activation)
    if (!/^\/api\/v1\/licensing\/dl\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(link.url)
      || !Number.isSafeInteger(link.expiresAt) || link.expiresAt <= now()) throw new Error('Invalid or expired download link')
    console.log('downloads/link OK')
    const response = await fetch(new URL(link.url, base), { redirect: 'error', signal: AbortSignal.timeout(120_000) })
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new Error(`download: HTTP ${response.status}`)
    }
    const hash = createHash('sha256')
    let bytes = 0
    if (response.body) {
      const reader = response.body.getReader()
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          bytes += value.byteLength
          hash.update(value)
        }
      } finally {
        reader.releaseLock()
      }
    }
    const digest = hash.digest('hex')
    if (selected && (bytes !== selected.size || (selected.sha256 && digest !== selected.sha256))) {
      throw new Error('Downloaded bytes do not match the signed catalog')
    }
    console.log(`download OK (${bytes} bytes)`)
    completed = true
  } finally {
    try {
      const reply = await post<{ deactivated: boolean }>('deactivate', { reason: 'user' }, firstLease.sub)
      if (reply.deactivated !== true) throw new Error('Invalid deactivation acknowledgment')
      console.log('deactivate OK')
    } catch (error) {
      if (completed) throw error
      console.error('Deactivation could not be confirmed. Release the seat in the portal if needed.')
    }
  }
}

main().catch((error: unknown) => {
  // Fetch and parser errors can carry request URLs or payload fragments.
  const message = error instanceof Error && error.constructor === Error ? error.message : 'Licensing simulator request failed'
  console.error(message)
  process.exitCode = 1
})
