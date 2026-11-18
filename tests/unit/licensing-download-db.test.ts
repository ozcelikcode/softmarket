import { sql } from '@payloadcms/db-sqlite'
import { link, mkdir, realpath, rename, symlink, truncate, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'

import { createLicensingDownload } from '@/lib/licensing/api/download-route'
import { openDownloadFile, streamDownload } from '@/lib/licensing/api/download-file'
import { createLicensingPost, flushLicensingObservations } from '@/lib/licensing/api/route'
import type { Endpoint } from '@/lib/licensing/api/guard'
import { hmacSha256, licensingHmacKey } from '@/lib/licensing/crypto/hmac'
import type { SigningKeyMetadata } from '@/lib/licensing/crypto/keys'
import { provisionSigningKey } from '@/lib/licensing/signing'
import { activateBody, DEVICE_IP, enableLicensingFixture, ISSUER, makeDevice, PROXY_SECRET, randomToken, signedRequest, verifyResponse } from './helpers/licensing-client'
import { setupLicensingDb, type Ctx } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const base = new Date()
const bytes = '0123456789abcdef'
const sha256 = 'a'.repeat(64)
const updateRequest = { channel: 'stable', currentVersion: '1.0.0', os: 'linux', arch: 'x64' }
const device = makeDevice()
let now: Date
let ctx: Ctx
let uploadDir: string
let signer: SigningKeyMetadata
let activation: string
let license: { id: number; key: string }
let otherProduct: number
let installer: number
let releaseId: number
let futureRelease: number
const dependencies = { loadPayload: async () => ctx.payload, now: () => new Date(now) }
const getFile = createLicensingDownload(dependencies)
const rawDb = () => ctx.payload.db.drizzle
const epoch = () => Math.floor(now.getTime() / 1000)

async function post(endpoint: Endpoint, body: object, options: Parameters<typeof signedRequest>[3] = {}, signingDevice = device) {
  const { request, nonce } = signedRequest(endpoint, body, signingDevice, {
    activation: endpoint === 'activate' ? '-' : activation, timestamp: epoch(), ...options,
  })
  const response = await createLicensingPost(endpoint, dependencies)(request)
  const raw = await response.text()
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.get('sm-key-id')).toBe(signer.kid)
  expect(verifyResponse(response.status, raw, response.headers.get('sm-response-signature')!, nonce, signer.publicKey)).toBe(true)
  return { status: response.status, body: JSON.parse(raw) }
}

async function issue(downloadId = installer) {
  const response = await post('downloads/link', { downloadId })
  expect(response.status).toBe(200)
  expect(response.body.expiresAt).toBe(epoch() + 300)
  expect(response.body.url).toMatch(/^\/api\/v1\/licensing\/dl\/[\w-]+\.[\w-]{43}$/)
  return response.body.url as string
}

function transfer(url: string, headers: Record<string, string> = {}, method = 'GET') {
  return getFile(new Request(ISSUER + url, {
    method, headers: { 'X-Softmarket-Proxy-Secret': PROXY_SECRET, 'X-Softmarket-Client-IP': DEVICE_IP, ...headers },
  }), url.slice(url.lastIndexOf('/') + 1))
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('sm-response-signature')).toBeNull()
  expect(await response.json()).toEqual({ error: { code }, serverTime: expect.any(Number) })
}

async function release(version: string, days: number, channel = 'stable', product = ctx.ids.product) {
  const releaseDate = new Date(base.getTime() + days * 86_400_000).toISOString()
  const [row] = await rawDb().all<{ id: number }>(sql`INSERT INTO releases (product_id, version, channel, release_date)
    VALUES (${product}, ${version}, ${channel}, ${releaseDate}) RETURNING id`)
  return row!.id
}

async function addDownload(filename: string, options: {
  product?: number; release?: number; os?: string; arch?: string; access?: string; mime?: string; checksum?: string; size?: number
} = {}) {
  const [media] = await rawDb().all<{ id: number }>(sql`INSERT INTO media (filename, mime_type, filesize, protected)
    VALUES (${filename}, ${options.mime ?? 'application/zip'}, ${options.size ?? bytes.length}, 1) RETURNING id`)
  const [download] = await rawDb().all<{ id: number }>(sql`INSERT INTO downloads (file_id, product_id, release_id, os, arch, access, checksum_sha256)
    VALUES (${media!.id}, ${options.product ?? ctx.ids.product}, ${options.release ?? null}, ${options.os ?? 'linux'},
      ${options.arch ?? null}, ${options.access ?? 'licensed'}, ${options.checksum ?? null}) RETURNING id`)
  return download!.id
}

beforeAll(async () => {
  vi.stubEnv('FORM_PROXY_SECRET', PROXY_SECRET)
  vi.stubEnv('SOFTMARKET_SECRETS_KEY', randomToken(32))
  vi.stubEnv('SOFTMARKET_LICENSE_SIGNING_KEY', '')
  now = new Date(base)
  ctx = await setupLicensingDb('l4-downloads')
  uploadDir = join(await realpath(ctx.dir), 'l4-uploads')
  vi.stubEnv('UPLOADS_DIR', uploadDir)
  await mkdir(uploadDir)
  await enableLicensingFixture(ctx.payload, ctx.ids.product)
  signer = await provisionSigningKey(ctx.payload)
  const created = await ctx.payload.create({
    collection: 'licenses', data: { customer: ctx.ids.customer, edition: ctx.ids.edition, startsAt: '2026-01-01T00:00:00.000Z', key: '', status: 'active' },
    context: { paymentsOrderFulfilment: true }, depth: 0,
  })
  license = created
  const enrollment = await post('activate', activateBody(license.key, device))
  expect(enrollment.status).toBe(200)
  activation = enrollment.body.activationId
  otherProduct = (await ctx.payload.create({ collection: 'products', data: {
    title: 'Other product', slug: 'other-product', family: ctx.ids.family, _status: 'published',
  } })).id
  releaseId = await release('1.10.0', -5)
  await release('1.9.0', -1)
  await release('1.20.0-beta.9', -2, 'beta')
  await release('1.20.0-beta.10', -3, 'beta')
  await release('2.0.0', -1, 'lts')
  await release('99.0.0', -1, 'stable', otherProduct)
  await release('not-semver', -1)
  futureRelease = await release('90.0.0', 1)
  installer = await addDownload('installer.zip', { release: releaseId, arch: 'x64', checksum: sha256.toUpperCase() })
  await writeFile(join(uploadDir, 'installer.zip'), bytes)
}, 240_000)

beforeEach(() => { now = new Date(base) })
afterAll(async () => {
  if (ctx) {
    await flushLicensingObservations(ctx.payload)
    await ctx.destroy()
  }
  vi.unstubAllEnvs()
})

it('returns the highest shipped SemVer in the exact channel with only matching download metadata', async () => {
  const universal = await addDownload('universal.zip', { release: releaseId, arch: 'universal', access: 'public' })
  const neutral = await addDownload('generic.zip', { release: releaseId })
  const arm = await addDownload('arm.zip', { release: releaseId, arch: 'arm64' })
  await addDownload('windows.zip', { release: releaseId, os: 'windows' })
  await addDownload('wrong-product.zip', { release: releaseId, product: otherProduct })

  const result = await post('updates', updateRequest)
  expect(result).toEqual({ status: 200, body: { latest: {
    version: '1.10.0', channel: 'stable', releaseDate: expect.any(String),
    mandatory: false, notesUrl: `/en/support/release-notes#rel-${ctx.ids.product}`,
    downloads: [
      { id: installer, os: 'linux', arch: 'x64', size: bytes.length, sha256 },
      { id: universal, os: 'linux', arch: 'universal', size: bytes.length },
      { id: neutral, os: 'linux', arch: null, size: bytes.length },
    ],
  } } })
  const anyArch = { channel: 'stable', currentVersion: '1.0.0', os: 'linux' }
  expect((await post('updates', anyArch)).body.latest.downloads.map(({ id }: { id: number }) => id)).toEqual([installer, universal, neutral, arm])
  expect((await post('updates', { ...updateRequest, channel: 'beta' })).body.latest.version).toBe('1.20.0-beta.10')
  expect((await post('updates', { ...updateRequest, channel: 'lts' })).body.latest.version).toBe('2.0.0')
  expect((await post('updates', { ...updateRequest, currentVersion: '1.10.0+local' })).body).toEqual({ latest: null })
})

it('shares signed authentication, skew, the activation bucket and nonce replay protection', async () => {
  const nonce = randomToken()
  expect((await post('updates', updateRequest, { nonce })).status).toBe(200)
  expect(await post('downloads/link', { downloadId: installer }, { nonce }))
    .toMatchObject({ status: 401, body: { error: { code: 'invalid_signature' } } })
  expect(await post('updates', updateRequest, { timestamp: epoch() - 301 }))
    .toMatchObject({ status: 400, body: { error: { code: 'clock_skew' } } })
  expect(await post('downloads/link', { downloadId: installer }, { headers: { 'SM-Signature': randomToken(64) } }))
    .toMatchObject({ status: 401, body: { error: { code: 'invalid_signature' } } })
  const limitedDevice = makeDevice()
  const enrollment = await post('activate', activateBody(license.key, limitedDevice), {}, limitedDevice)
  expect(enrollment.status).toBe(200)
  const limited = { activation: enrollment.body.activationId }
  const current = await ctx.payload.findGlobal({ slug: 'licensing-settings' })
  await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { limits: { requestsPerActivationPerHour: 1 } } })
  try {
    expect((await post('updates', updateRequest, limited, limitedDevice)).status).toBe(200)
    expect(await post('downloads/link', { downloadId: installer }, limited, limitedDevice))
      .toMatchObject({ status: 429, body: { error: { code: 'rate_limited', retryAfter: expect.any(Number) } } })
  } finally {
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { limits: current.limits } })
  }
})

it.each([
  ['suspended', 'license_suspended', "UPDATE licenses SET status = 'suspended'"],
  ['revoked', 'license_revoked', "UPDATE licenses SET status = 'revoked'"],
  ['expired flag', 'license_expired', "UPDATE licenses SET status = 'expired'"],
  ['elapsed term', 'license_expired', "UPDATE licenses SET expires_at = '2026-01-02T00:00:00.000Z'"],
  ['future term', 'license_not_started', "UPDATE licenses SET starts_at = '2099-01-01T00:00:00.000Z'"],
  ['deactivated device', 'activation_revoked', "UPDATE license_activations SET status = 'deactivated'"],
])('checks entitlement for %s on both POSTs and on a previously issued URL', async (_case, code, statement) => {
  const url = await issue()
  await rawDb().run(sql.raw(statement))
  try {
    for (const [endpoint, body] of [['updates', updateRequest], ['downloads/link', { downloadId: installer }]] as const) {
      expect(await post(endpoint, body)).toMatchObject({ status: 403, body: { error: { code } } })
    }
    await expectError(await transfer(url, { Range: 'bytes=999-' }), 403, code)
  } finally {
    await rawDb().run(sql`UPDATE licenses SET status = 'active', expires_at = NULL, starts_at = '2026-01-01T00:00:00.000Z'`)
    await rawDb().run(sql`UPDATE license_activations SET status = 'active'`)
  }
})

it('gives the same denial for missing, foreign, future and cross-linked download records', async () => {
  const foreign = await addDownload('foreign.zip', { product: otherProduct })
  const future = await addDownload('future.zip', { release: futureRelease })
  const foreignRelease = await release('1.0.0', -1, 'stable', otherProduct)
  const crossLinked = await addDownload('cross-linked.zip', { release: foreignRelease })
  for (const downloadId of [999999, foreign, future, crossLinked]) {
    expect(await post('downloads/link', { downloadId })).toMatchObject({
      status: 403, body: { error: { code: 'download_unavailable' } },
    })
  }
})

it('fails closed when a public reference would otherwise expose another product’s licensed media', async () => {
  const publicDownload = await addDownload('conflict.zip', { access: 'public' })
  await writeFile(join(uploadDir, 'conflict.zip'), bytes)
  const url = await issue(publicDownload)
  await rawDb().run(sql`INSERT INTO downloads (file_id, product_id, os, access)
    SELECT file_id, ${otherProduct}, os, 'licensed' FROM downloads WHERE id = ${publicDownload}`)
  expect(await post('downloads/link', { downloadId: publicDownload })).toMatchObject({
    status: 403, body: { error: { code: 'download_unavailable' } },
  })
  await expectError(await transfer(url), 403, 'download_unavailable')
})

it('authenticates the compact payload and rejects tampering, encoded aliases, valid unissued tags and exact expiry', async () => {
  const url = await issue()
  const [encoded, signature] = url.slice(url.lastIndexOf('/') + 1).split('.')
  const claims = JSON.parse(Buffer.from(encoded!, 'base64url').toString())
  const key = licensingHmacKey('download')!
  expect(claims).toEqual({ d: installer, a: activation, e: epoch() + 300, n: expect.stringMatching(/^[\w-]{22}$/) })
  expect(signature).toBe(hmacSha256(key, encoded!))
  const unissued = Buffer.from(JSON.stringify({ ...claims, n: randomToken() })).toString('base64url')
  const wrongActivation = Buffer.from(JSON.stringify({ ...claims, a: `act_${'0'.repeat(24)}` })).toString('base64url')
  for (const candidate of [
    url.replace(/.$/, (last) => last === 'A' ? 'B' : 'A'),
    url.replace('.', '%2E'),
    `/api/v1/licensing/dl/${unissued}.${hmacSha256(key, unissued)}`,
    `/api/v1/licensing/dl/${wrongActivation}.${signature}`,
  ]) await expectError(await transfer(candidate), 401, 'invalid_token')

  now = new Date((claims.e - 1) * 1000)
  const valid = await transfer(url)
  expect(valid.status).toBe(200)
  expect(await valid.text()).toBe(bytes)
  now = new Date(claims.e * 1000)
  await expectError(await transfer(url), 401, 'invalid_token')
})

it('admits at most five simultaneous GETs and lets HEAD inspect without spending a use', async () => {
  const url = await issue()
  const head = await transfer(url, { Range: 'bytes=0-1' }, 'HEAD')
  expect(head.status).toBe(200)
  expect(head.headers.get('content-length')).toBe(String(bytes.length))
  expect(head.headers.get('content-range')).toBeNull()
  expect(await head.text()).toBe('')
  const responses = await Promise.all(Array.from({ length: 12 }, () => transfer(url, { Range: 'bytes=0-0' })))
  const successes = responses.filter(({ status }) => status === 206)
  expect(successes).toHaveLength(5)
  for (const response of responses) {
    if (response.status === 206) expect(await response.text()).toBe('0')
    else await expectError(response, 401, 'invalid_token')
  }
  const exhausted = await transfer(url, {}, 'HEAD')
  expect(exhausted.status).toBe(401)
  expect(await exhausted.text()).toBe('')
})

it('invalidates links when the download is repointed, its bytes are replaced or the activation changes license', async () => {
  const url = await issue()
  const other = await addDownload('replacement.zip')
  await writeFile(join(uploadDir, 'replacement.zip'), 'changed')
  await rawDb().run(sql`UPDATE downloads SET file_id = (SELECT file_id FROM downloads WHERE id = ${other}) WHERE id = ${installer}`)
  try {
    await expectError(await transfer(url), 403, 'download_unavailable')
  } finally {
    await rawDb().run(sql`UPDATE downloads SET file_id = (SELECT id FROM media WHERE filename = 'installer.zip') WHERE id = ${installer}`)
  }

  const beforeChange = await issue(other)
  await writeFile(join(uploadDir, 'replacement.zip'), 'replace')
  await expectError(await transfer(beforeChange), 403, 'download_unavailable')
  const newLink = await issue(other)
  expect(await (await transfer(newLink)).text()).toBe('replace')

  const another = await ctx.payload.create({
    collection: 'licenses', data: { customer: ctx.ids.customer, edition: ctx.ids.edition, startsAt: '2026-01-01T00:00:00.000Z', key: '', status: 'active' },
    context: { paymentsOrderFulfilment: true }, depth: 0,
  })
  await rawDb().run(sql`UPDATE license_activations SET license_id = ${another.id}`)
  try {
    await expectError(await transfer(url), 403, 'download_unavailable')
  } finally {
    await rawDb().run(sql`UPDATE license_activations SET license_id = ${license.id}`)
  }
})

it('denies traversal, absolute, encoded, symlink, hard link, case-alias and derivative collisions', async () => {
  const outside = join(await realpath(ctx.dir), 'outside.zip')
  await writeFile(outside, 'out-of-scope')
  await symlink(outside, join(uploadDir, 'symlink.zip'))
  await link(outside, join(uploadDir, 'hardlink.zip'))
  for (const filename of [
    '../outside.zip', '..\\outside.zip', '%2e%2e%2foutside.zip', '%252e%252e%252foutside.zip',
    outside, 'C:\\outside.zip', 'C:outside.zip', 'symlink.zip', 'hardlink.zip', 'line\r\nbreak.zip',
    // Case-insensitive volumes (macOS dev) would otherwise open installer.zip; Linux has no such file.
    'INSTALLER.zip',
  ]) {
    const downloadId = await addDownload(filename)
    expect(await post('downloads/link', { downloadId })).toMatchObject({ status: 403, body: { error: { code: 'download_unavailable' } } })
  }
  const url = await issue()
  // The release layout links releases/<id>/uploads to shared/uploads: the configured root may be a
  // symlink, while every entry beneath the resolved directory is still opened without following links.
  await rename(uploadDir, `${uploadDir}-original`)
  await symlink(`${uploadDir}-original`, uploadDir)
  try {
    const aliased = await transfer(url)
    expect(aliased.status).toBe(200)
    expect(await aliased.text()).toBe(bytes)
  } finally {
    await rename(uploadDir, `${uploadDir}-alias`)
    await rename(`${uploadDir}-original`, uploadDir)
  }
  await rawDb().run(sql`UPDATE media SET sizes_thumb_filename = 'installer.zip' WHERE filename = 'replacement.zip'`)
  try {
    await expectError(await transfer(url), 403, 'download_unavailable')
  } finally {
    await rawDb().run(sql`UPDATE media SET sizes_thumb_filename = NULL WHERE filename = 'replacement.zip'`)
  }
})

it('streams full and single-range representations with safe content headers and If-Range', async () => {
  const download = await addDownload('résumé";installer.zip', { mime: 'application/x-custom\r\nX-Injected: yes' })
  await writeFile(join(uploadDir, 'résumé";installer.zip'), bytes)
  const url = await issue(download)
  const full = await transfer(url)
  expect(full.status).toBe(200)
  expect(full.headers.get('accept-ranges')).toBe('bytes')
  expect(full.headers.get('cache-control')).toBe('private, no-store, no-transform')
  expect(full.headers.get('content-type')).toBe('application/octet-stream')
  expect(full.headers.get('x-injected')).toBeNull()
  expect(full.headers.get('content-disposition')).toBe('attachment; filename="r_sum__\x3binstaller.zip"; filename*=UTF-8\'\'r%C3%A9sum%C3%A9%22%3Binstaller.zip')
  expect(full.headers.get('sm-response-signature')).toBeNull()
  expect(full.headers.get('etag')).toMatch(/^"[\w-]+"$/)
  expect(full.headers.get('last-modified')).toBeTruthy()
  expect(await full.text()).toBe(bytes)

  const etag = full.headers.get('etag')!
  for (const [range, body, contentRange] of [
    ['bytes=3-7', '34567', 'bytes 3-7/16'],
    ['bytes=12-', 'cdef', 'bytes 12-15/16'],
    ['bytes=-3', 'def', 'bytes 13-15/16'],
    ['bytes=0-99999999999999999999999', bytes, 'bytes 0-15/16'],
  ] as const) {
    const response = await transfer(url, { Range: range, 'If-Range': etag })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(contentRange)
    expect(response.headers.get('content-length')).toBe(String(body.length))
    expect(await response.text()).toBe(body)
  }
  const etagUrl = await issue(download)
  for (const validator of ['"other"', `W/${etag}`, full.headers.get('last-modified')!]) {
    const response = await transfer(etagUrl, { Range: 'bytes=3-7', 'If-Range': validator })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-range')).toBeNull()
    expect(await response.text()).toBe(bytes)
  }
})

it('rejects malformed, multi-range and unsatisfiable GETs without spending a use', async () => {
  const url = await issue()
  for (const range of ['bytes=1-2,5-6', 'bytes=a-b', 'bytes=9-3', 'bytes=-0', 'bytes=16-', 'bytes=-', 'items=0-1']) {
    const response = await transfer(url, { Range: range })
    expect(response.headers.get('content-range')).toBe('bytes */16')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    await expectError(response, 416, 'range_not_satisfiable')
  }
  expect(await (await transfer(url)).text()).toBe(bytes)
  const empty = await addDownload('empty.zip', { size: 0 })
  await writeFile(join(uploadDir, 'empty.zip'), '')
  const emptyUrl = await issue(empty)
  const none = await transfer(emptyUrl, { Range: 'bytes=0-' })
  expect(none.headers.get('content-range')).toBe('bytes */0')
  await expectError(none, 416, 'range_not_satisfiable')
  const zero = await transfer(emptyUrl)
  expect(zero.status).toBe(200)
  expect(zero.headers.get('content-length')).toBe('0')
  expect(await zero.text()).toBe('')
})

it('bounds read-ahead for a large sparse file and closes the descriptor on abort or cancellation', async () => {
  const name = 'sparse.zip'
  await writeFile(join(uploadDir, name), 'first chunk')
  await truncate(join(uploadDir, name), 128 * 1024 * 1024)
  for (const action of ['abort', 'cancel']) {
    const file = (await openDownloadFile(name))!
    const createStream = vi.spyOn(file.handle, 'createReadStream')
    const controller = new AbortController()
    const reader = streamDownload(file, controller.signal, null).getReader()
    const source = createStream.mock.results[0]!.value
    try {
      expect((await reader.read()).value?.byteLength).toBe(64 * 1024)
      await vi.waitFor(() => expect(source.bytesRead).toBeGreaterThan(64 * 1024))
      expect(source.bytesRead).toBeLessThanOrEqual(256 * 1024)
    } finally {
      if (action === 'abort') controller.abort()
      else await reader.cancel()
      reader.releaseLock()
      await vi.waitFor(() => expect(file.handle.fd).toBe(-1))
    }
  }
})

it('returns 503 on all L4 routes when disabled, including valid and invalid file URLs', async () => {
  const url = await issue()
  await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { apiEnabled: false } })
  try {
    expect(await post('updates', updateRequest)).toMatchObject({ status: 503, body: { error: { code: 'unavailable' } } })
    expect(await post('downloads/link', { downloadId: installer })).toMatchObject({ status: 503, body: { error: { code: 'unavailable' } } })
    for (const path of [url, '/api/v1/licensing/dl/bad']) await expectError(await transfer(path), 503, 'unavailable')
  } finally {
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { apiEnabled: true } })
  }
})

it('batches download events while keeping full IP, raw fingerprint, license key and bearer token out of telemetry', async () => {
  const loggers = ['error', 'warn', 'info'] as const
  const logs = loggers.map((level) => vi.spyOn(ctx.payload.logger, level).mockImplementation(() => undefined))
  try {
    const url = await issue()
    const anotherPrefix = '198.51.100.87'
    const before = await rawDb().all<{ type: string; count: number }>(sql`
      SELECT type, count FROM security_events WHERE type LIKE 'download.%' AND ip_prefix = '198.51.100.0/24'`)
    expect(before).toHaveLength(0)
    for (let index = 0; index < 2; index++) {
      const response = await transfer(url, { 'X-Softmarket-Client-IP': anotherPrefix })
      expect(await response.text()).toBe(bytes)
    }
    await flushLicensingObservations(ctx.payload)
    const observations = await rawDb().all<{ type: string; count: number; ip_prefix: string; ip_hash: string }>(sql`
      SELECT * FROM security_events WHERE type LIKE 'download.%'`)
    expect(observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'download.link_issued', ip_prefix: '203.0.113.0/24' }),
      expect.objectContaining({ type: 'download.started', count: 2, ip_prefix: '198.51.100.0/24', ip_hash: expect.stringMatching(/^[\w-]{43}$/) }),
    ]))
    const text = JSON.stringify({
      logs: logs.flatMap((log) => log.mock.calls),
      observations,
      receipts: await rawDb().all(sql`SELECT * FROM security_audit WHERE action IN ('api.updates', 'api.downloads/link')`),
      activations: await rawDb().all(sql`SELECT * FROM license_activations`),
    })
    for (const secret of [DEVICE_IP, anotherPrefix, device.fingerprint, license.key, url.split('/').at(-1)!]) {
      expect(text.includes(secret)).toBe(false)
    }
  } finally {
    logs.forEach((log) => log.mockRestore())
  }
})
