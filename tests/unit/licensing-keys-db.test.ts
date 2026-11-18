import { execFile } from 'node:child_process'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { inspect, promisify } from 'node:util'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/(payload)/api/v1/licensing/keys/route'
import {
  LICENSING_SIGNING_SECRET_ID, openSecret, parseVault, readIntegrationsDoc, writeSecret,
} from '@/lib/integrations/vault'
import { ed25519PublicMetadata, importEd25519PublicKey, SIGNING_KEY_OVERLAP_MS, verifyEd25519 } from '@/lib/licensing/crypto/keys'
import { licensingKeysResponse } from '@/lib/licensing/public-keys'
import { loadLicensingSigner, provisionSigningKey, revokeSigningKey } from '@/lib/licensing/signing'
import { decryptSecret, readSecretsKey } from '@/lib/secrets/crypto'
import { setupLicensingDb, type Ctx, type Principal } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const run = promisify(execFile)
const master = randomBytes(32).toString('base64url')
const env = { SOFTMARKET_SECRETS_KEY: master, SOFTMARKET_LICENSE_SIGNING_KEY: '' }
const MIGRATED_NOW = new Date('2026-11-18T12:00:00.000Z')
const principals: Principal[] = ['anonymous', 'customer', 'editor', 'apiKey', 'adminBearer', 'admin']

let ctx: Ctx

const readVaultDocument = () => readIntegrationsDoc(ctx.payload)
const keysResponse = (now: Date) => licensingKeysResponse(async () => ctx.payload, now)
const settings = () => ctx.payload.findGlobal({ slug: 'licensing-settings', depth: 0, overrideAccess: true })
const enableApi = (apiEnabled: boolean) => ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { apiEnabled }, overrideAccess: true })
const generated = (options: { rotate?: boolean; now?: Date } = {}) =>
  provisionSigningKey(ctx.payload, { env, now: MIGRATED_NOW, ...options })
const jwk = (key: { kid: string; publicKey: string }) => ({ kid: key.kid, alg: 'EdDSA', x: key.publicKey })

beforeAll(async () => { ctx = await setupLicensingDb('l2-signing-keys') }, 60_000)
beforeEach(async () => {
  await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { apiEnabled: false, signingKeys: [] } })
  await ctx.payload.updateGlobal({ slug: 'integrations', data: { secrets: {} } })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
afterAll(async () => { await ctx?.destroy() })

describe('licensing signing key lifecycle', () => {
  it('does not initialize an empty global or write while serving public metadata', async () => {
    const reader = new DatabaseSync(join(ctx.dir, 'test.db'), { readOnly: true })
    const version = () => reader.prepare('PRAGMA data_version').get()!.data_version
    try {
      await ctx.run('DELETE FROM licensing_settings')
      const empty = version()
      expect((await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))).status).toBe(503)
      expect(version()).toBe(empty)
      await generated()
      await enableApi(true)
      const ready = version()
      expect((await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))).status).toBe(200)
      expect(version()).toBe(ready)
    } finally {
      reader.close()
    }
  })

  it('fails closed on ambiguous or mismatched stored metadata', async () => {
    const original = await generated()
    await enableApi(true)
    const keys = (await settings()).signingKeys!
    const table = 'licensing_settings_signing_keys'
    await ctx.run(`UPDATE ${table} SET kid = 'corrupt'`)
    const unavailable = await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toEqual({ error: { code: 'unavailable' }, serverTime: expect.any(Number) })
    expect(await loadLicensingSigner(ctx.payload, env)).toBeNull()
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', data: { signingKeys: keys } })
    await generated({ rotate: true })
    await ctx.run(`UPDATE ${table} SET retired_at = NULL WHERE kid = '${original.kid}'`)
    expect((await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))).status).toBe(503)
    expect(await loadLicensingSigner(ctx.payload, env)).toBeNull()
  })

  it('publishes only public keys and uses 503 with no-store while disabled or uninitialized', async () => {
    const disabled = await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))
    expect(disabled.status).toBe(503)
    expect(disabled.headers.get('cache-control')).toBe('no-store')
    expect(disabled.headers.get('x-robots-tag')).toBe('noindex')
    expect(await disabled.json()).toEqual({ error: { code: 'unavailable' }, serverTime: expect.any(Number) })

    await enableApi(true)
    const missing = await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))
    expect(missing.status).toBe(503)
    expect(await missing.json()).toEqual({ error: { code: 'unavailable' }, serverTime: expect.any(Number) })
    const key = await generated()
    const reads = vi.spyOn(ctx.payload, 'findGlobal')
    const live = await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))
    expect(live.status).toBe(200)
    expect(live.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(live.headers.get('date')).not.toBeNull()
    expect(live.headers.get('x-robots-tag')).toBe('noindex')
    expect(live.headers.get('access-control-allow-origin')).toBeNull()
    expect(await live.json()).toEqual({ keys: [jwk(key)], revokedKids: [] })
    expect(reads.mock.calls.map(([argument]) => argument.slug)).toEqual(['licensing-settings'])
    await enableApi(false)
    expect((await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))).status).toBe(503)
  })

  it('requires a vault key and serializes concurrent bootstrap attempts', async () => {
    await expect(provisionSigningKey(ctx.payload, { env: {} })).rejects.toMatchObject({ code: 'vault_key_required' })
    const results = await Promise.allSettled([generated(), generated()])
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find(({ status }) => status === 'rejected')
    expect(rejected).toMatchObject({ reason: { code: 'active_key_exists' } })
    const entry = parseVault((await readVaultDocument()).secrets)[LICENSING_SIGNING_SECRET_ID]
    expect(entry).toMatchObject({ enc: expect.stringMatching(/^sm1\./), last4: null })
    expect(() => decryptSecret(entry!.enc, 'smtp.password', readSecretsKey(env))).toThrow('secrets: tampered')
    const signer = await loadLicensingSigner(ctx.payload, env)
    expect(signer?.kid).toBe((await settings()).signingKeys?.[0]?.kid)
    const message = Buffer.from('signing readiness probe')
    const publicKey = importEd25519PublicKey((await settings()).signingKeys![0]!.publicKey)!
    expect(verifyEd25519(publicKey, message, signer!.sign(message))).toBe(true)
    const wrongMaster = { SOFTMARKET_SECRETS_KEY: randomBytes(32).toString('base64url') }
    expect(await loadLicensingSigner(ctx.payload, wrongMaster)).toBeNull()
    expect(await loadLicensingSigner(ctx.payload, {})).toBeNull()
    await expect(provisionSigningKey(ctx.payload, { rotate: true, env: wrongMaster })).rejects.toMatchObject({ code: 'vault_key_unreadable' })
    expect((await loadLicensingSigner(ctx.payload, env))?.kid).toBe(signer!.kid)
  })

  it('rotates the active key, enforces the overlap boundary and publishes durable revocation notices', async () => {
    const first = await generated()
    const rotation = new Date(MIGRATED_NOW.getTime() + 1000)
    const second = await generated({ rotate: true, now: rotation })
    expect((await settings()).signingKeys).toMatchObject([
      { ...second, createdAt: rotation.toISOString(), retiredAt: null },
      { ...first, createdAt: MIGRATED_NOW.toISOString(), retiredAt: rotation.toISOString() },
    ])
    expect((await loadLicensingSigner(ctx.payload, env))?.kid).toBe(second.kid)
    await enableApi(true)
    const overlapEnd = rotation.getTime() + SIGNING_KEY_OVERLAP_MS
    expect(await (await keysResponse(new Date(overlapEnd - 1))).json()).toEqual({
      keys: [jwk(second), jwk(first)], revokedKids: [],
    })
    expect(await (await keysResponse(new Date(overlapEnd))).json()).toEqual({ keys: [jwk(second)], revokedKids: [] })
    await revokeSigningKey(ctx.payload, first.kid, rotation)
    await revokeSigningKey(ctx.payload, first.kid, new Date(overlapEnd))
    expect((await settings()).signingKeys?.find(({ kid }) => kid === first.kid)?.revokedAt).toBe(rotation.toISOString())
    expect(await (await keysResponse(rotation)).json()).toEqual({ keys: [jwk(second)], revokedKids: [first.kid] })
    await revokeSigningKey(ctx.payload, second.kid, rotation)
    expect(await loadLicensingSigner(ctx.payload, env)).toBeNull()
    expect(await (await keysResponse(rotation)).json()).toEqual({ keys: [], revokedKids: [second.kid, first.kid] })
    await expect(revokeSigningKey(ctx.payload, 'missing')).rejects.toMatchObject({ code: 'unknown_signing_key' })
  })

  it('rolls back the vault write when the metadata write fails and preserves the key across integration edits', async () => {
    vi.stubEnv('SOFTMARKET_SECRETS_KEY', master)
    const original = await generated()
    expect((await writeSecret(ctx.payload, 'stripe.sandbox.webhookSecret', 'whsec_test')).code).toBe('ok')
    const before = parseVault((await readVaultDocument()).secrets)
    const update = ctx.payload.updateGlobal.bind(ctx.payload)
    const spy = vi.spyOn(ctx.payload, 'updateGlobal').mockImplementation(async (argument) => {
      if (argument.slug === 'licensing-settings') throw new Error('test_metadata_write_failure')
      return update(argument)
    })
    await expect(generated({ rotate: true })).rejects.toThrow('test_metadata_write_failure')
    spy.mockRestore()
    expect(parseVault((await readVaultDocument()).secrets)).toEqual(before)
    expect((await settings()).signingKeys).toMatchObject([original])
    expect((await loadLicensingSigner(ctx.payload, env))?.kid).toBe(original.kid)
    await generated({ rotate: true })
    expect(parseVault((await readVaultDocument()).secrets)['stripe.sandbox.webhookSecret']).toEqual(before['stripe.sandbox.webhookSecret'])
  })

  it('gives the configured environment key precedence with no fallback and supports public-only registration', async () => {
    const original = await generated()
    const bad = { ...env, SOFTMARKET_LICENSE_SIGNING_KEY: 'malformed' }
    expect(await loadLicensingSigner(ctx.payload, bad)).toBeNull()
    await expect(provisionSigningKey(ctx.payload, { env: bad })).rejects.toMatchObject({ code: 'environment_key_configured' })
    await expect(provisionSigningKey(ctx.payload, { env: bad, registerEnv: true, rotate: true })).rejects.toMatchObject({ code: 'invalid_environment_key' })
    const privateKey = generateKeyPairSync('ed25519').privateKey
    const external = { SOFTMARKET_LICENSE_SIGNING_KEY: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() }
    expect(await loadLicensingSigner(ctx.payload, external)).toBeNull()
    await expect(provisionSigningKey(ctx.payload, { env: external, registerEnv: true })).rejects.toMatchObject({ code: 'active_key_exists' })
    const vault = parseVault((await readVaultDocument()).secrets)
    const added = await provisionSigningKey(ctx.payload, { env: external, registerEnv: true, rotate: true, now: MIGRATED_NOW })
    expect(added).toEqual(ed25519PublicMetadata(privateKey))
    delete vault[LICENSING_SIGNING_SECRET_ID]
    expect(parseVault((await readVaultDocument()).secrets)).toEqual(vault)
    const reads = vi.spyOn(ctx.payload, 'findGlobal')
    expect((await loadLicensingSigner(ctx.payload, external))?.kid).toBe(added.kid)
    expect(reads.mock.calls.map(([argument]) => argument.slug)).toEqual(['licensing-settings'])
    reads.mockRestore()
    expect(await loadLicensingSigner(ctx.payload, env)).toBeNull()
    await enableApi(true)
    expect(await (await keysResponse(MIGRATED_NOW)).json()).toEqual({ keys: [jwk(added), jwk(original)], revokedKids: [] })
  })

  it('runs the install CLI on the temporary DB, prints only public metadata, and requires --rotate', async () => {
    const cli = (...args: string[]) => run(process.execPath, ['--import', 'tsx', 'scripts/licensing-keygen.ts', ...args], {
      env: { ...process.env, ...env },
    })
    const first = await cli()
    expect(first.stderr).toBe('')
    const publicOnly = (output: string) => /^\{"kid":"[A-Za-z0-9_-]{43}","publicKey":"[A-Za-z0-9_-]{43}"\}\n$/.test(output)
    expect(publicOnly(first.stdout)).toBe(true)
    await expect(cli()).rejects.toMatchObject({ code: 1, stdout: '', stderr: 'licensing:keygen active_key_exists\n' })
    const second = await cli('--rotate')
    expect(second.stderr).toBe('')
    expect(publicOnly(second.stdout)).toBe(true)
    expect(second.stdout).not.toBe(first.stdout)
    expect((await settings()).signingKeys).toMatchObject([JSON.parse(second.stdout), JSON.parse(first.stdout)])
  }, 30_000)

  it('keeps private material out of HTTP responses, persisted settings and logs', async () => {
    const logs: string[] = []
    const capture = (...args: unknown[]) => { logs.push(inspect(args)) }
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation(capture)
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) vi.spyOn(ctx.payload.logger, level).mockImplementation(capture)
    const key = await generated()
    const doc = await readVaultDocument()
    const ciphertext = parseVault(doc.secrets)[LICENSING_SIGNING_SECRET_ID]!.enc
    const privateDer = openSecret(doc, LICENSING_SIGNING_SECRET_ID, readSecretsKey(env))!.reveal()
    const der = Buffer.from(privateDer, 'base64url')
    const seed = der.subarray(-32)
    const privateForms = [privateDer, der.toString('base64'), seed.toString('hex'), seed.toString('base64'),
      seed.toString('base64url'), master, '-----BEGIN PRIVATE KEY-----']
    await enableApi(true)
    const response = await GET(new Request('https://licensing.example.test/api/v1/licensing/keys'))
    const samples = [await response.text(), JSON.stringify([...response.headers]), JSON.stringify(await settings())]
    for (const who of principals) {
      samples.push(JSON.stringify(await ctx.rest('GET', 'globals/licensing-settings', who)))
      samples.push(JSON.stringify(await ctx.rest('GET', 'globals/integrations?select[secrets]=true', who)))
    }
    expect((await ctx.rest('POST', 'globals/integrations/secret', 'admin', {
      id: LICENSING_SIGNING_SECRET_ID, clear: true,
    })).json).toEqual({ code: 'unknown_secret' })
    const failed = await licensingKeysResponse(async () => { throw new Error(privateDer) })
    expect(failed.status).toBe(503)
    samples.push(await failed.text())
    const sign = await loadLicensingSigner(ctx.payload, env)
    expect(sign?.kid).toBe(key.kid)
    samples.push(inspect(sign), JSON.stringify(sign))
    expect(samples.some((sample) => sample.includes(ciphertext))).toBe(false)
    expect([...samples, ...logs].some((sample) => privateForms.some((secret) => sample.includes(secret)))).toBe(false)
  })
})
