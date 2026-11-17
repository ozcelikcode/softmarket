import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

/*
 * Entegrasyon ayarları on a real temporary SQLite database: migration, write-only secrets through the admin endpoint
 * (REST, real Payload auth), read matrix (REST/GraphQL/Local API: no role ever gets plaintext or ciphertext), DB file
 * scan, env precedence at runtime, panel SMTP transport + test e-mail endpoint, legal approval + company placeholders,
 * and log / RSC output scans. No network: fake fetch / fake mail sender.
 */
const NAME = '20261117_092957_integrations_settings'
const ORIGIN = 'http://127.0.0.1:3100'
const KEY = Buffer.alloc(32, 3).toString('base64')
const ADMIN = { email: 'admin.int@example.test', password: 'Admin-int-password-123' }
const ADMIN2 = { email: 'admin2.int@example.test', password: 'Admin2-int-password-123' }
const EDITOR = { email: 'editor.int@example.test', password: 'Editor-int-password-123' }
const CUSTOMER = { email: 'customer.int@example.test', password: 'Customer-int-password-123' }
const API_KEY = 'int-admin-api-key-0123456789abcdef'
const PLAIN = {
  'iyzico.sandbox.apiKey': 'sandbox-INTPLAIN-api-7781',
  'iyzico.sandbox.secretKey': 'sandbox-INTPLAIN-secret-7782',
  'stripe.sandbox.secretKey': 'sk_test_INTPLAIN_stripe_7783',
  'stripe.sandbox.webhookSecret': 'whsec_INTPLAIN_hook_7784',
  'smtp.password': 'INTPLAIN smtp pässword 7785',
} as const

let payload: Payload
let dir: string
const saved = { ...process.env }
const logs: string[] = []
const run = (q: string) => payload.db.drizzle.$client.execute(q)
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
type MigrateArgs = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']
let migration: Migration
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
const config = async () => (await import('../../src/payload.config')).default
const token = async (collection: 'users' | 'customers', data: { email: string; password: string }) => (await payload.login({ collection, data })).token!
let jwt: { admin: string; admin2: string; editor: string; customer: string }
const panel = (j: string) => ({ origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: `payload-token=${j}` })

async function rest(method: 'GET' | 'POST', path: string[], headers: Record<string, string>, body?: unknown) {
  const routes = await import('@payloadcms/next/routes')
  const handler = method === 'GET' ? routes.REST_GET(await config()) : routes.REST_POST(await config())
  const res = await handler(new Request(`${ORIGIN}/api/${path.join('/')}`, {
    method, headers: { host: '127.0.0.1:3100', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }), { params: Promise.resolve({ slug: path }) })
  return { status: res.status, text: await res.text() }
}
const setSecret = (headers: Record<string, string>, body: unknown) => rest('POST', ['globals', 'integrations', 'secret'], headers, body)
const testEmail = (headers: Record<string, string>) => rest('POST', ['globals', 'integrations', 'test-email'], headers, {})
const dbBytes = () => [`${dir}/test.db`, `${dir}/test.db-wal`].filter(existsSync).map((f) => readFileSync(f)).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0))
const noLeak = (text: string) => {
  for (const value of Object.values(PLAIN)) expect(text).not.toContain(value)
  expect(text).not.toMatch(/sm1\.[0-9a-f]{12}\./)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-int-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  process.env.SOFTMARKET_SECRETS_KEY = KEY
  for (const k of ['PAYMENTS_ENABLED', 'PAYMENTS_STRIPE_ENABLED', 'SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD', 'IYZICO_API_KEY', 'IYZICO_SECRET_KEY', 'IYZICO_BASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_API_BASE']) delete process.env[k]
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: await config() })
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBeGreaterThanOrEqual(0)
  migration = migrations[index]!
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  await run(`INSERT INTO pages(id,page_type,_status) VALUES(1,'legal','published')`)
  await run(`INSERT INTO pages_locales(title,slug,_locale,_parent_id) VALUES('Eski','eski','tr',1)`)
  if ((await run('SELECT COUNT(*) AS n FROM site_settings')).rows[0]!.n === 0) await run('INSERT INTO site_settings(id) VALUES(1)')
  for (const level of ['info', 'warn', 'error', 'debug', 'fatal'] as const) {
    const original = payload.logger[level].bind(payload.logger)
    vi.spyOn(payload.logger, level).mockImplementation(((...a: unknown[]) => { logs.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); return original(...(a as [string])) }) as never)
  }
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, level).mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')))
}, 240000)

afterAll(async () => {
  vi.restoreAllMocks()
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.env = saved
})

describe(`migration ${NAME}`, () => {
  it('up(): CREATE TABLE + ADD COLUMN only; down() restores the schema and refuses while settings exist', async () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|UPDATE `/)
    expect(down).not.toMatch(/__new_|INSERT INTO|RENAME|DELETE FROM|CREATE TABLE/)
    expect([...up!.matchAll(/CREATE TABLE \\`(\w+)\\`/g)].map((m) => m[1])).toEqual(['integrations'])
    expect([...up!.matchAll(/ALTER TABLE \\`(\w+)\\` ADD \\`(\w+)\\`/g)].map((m) => `${m[1]}.${m[2]}`).sort()).toEqual([
      '_pages_v_locales.version_legal_review_approved_at', '_pages_v_locales.version_legal_review_approved_by', '_pages_v_locales.version_legal_review_approved_hash',
      'pages_locales.legal_review_approved_at', 'pages_locales.legal_review_approved_by', 'pages_locales.legal_review_approved_hash',
      'site_settings.company_etbis_no',
    ])
    const snapshot = async () => ({
      pages: (await run('SELECT * FROM pages_locales')).rows.map((r) => ({ ...r })),
      site: (await run('SELECT * FROM site_settings')).rows.map((r) => ({ ...r })),
    })
    const before = await snapshot()
    await migration.up(args())
    const after = await snapshot()
    const strip = (rows: Record<string, unknown>[], cols: string[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !cols.includes(k))))
    expect(strip(after.pages, ['legal_review_approved_by', 'legal_review_approved_at', 'legal_review_approved_hash'])).toEqual(before.pages)
    expect(strip(after.site, ['company_etbis_no'])).toEqual(before.site)
    await migration.down(args())
    expect(await snapshot()).toEqual(before)
    expect((await run(`SELECT name FROM sqlite_master WHERE name = 'integrations'`)).rows).toHaveLength(0)
    expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
    await migration.up(args())
    await run(`INSERT INTO integrations(id, secrets) VALUES(1, '{}')`)
    await expect(migration.down(args())).rejects.toThrow(/down refused/)
    await run(`UPDATE integrations SET secrets = NULL`)
    await run(`UPDATE integrations SET smtp_port = 2525`)
    await expect(migration.down(args())).rejects.toThrow(/down refused/)
    await run(`UPDATE integrations SET smtp_port = 587, smtp_secure = 1`)
    await expect(migration.down(args())).rejects.toThrow(/down refused/)
    await run(`UPDATE integrations SET smtp_secure = 0`)
    await run(`UPDATE pages_locales SET legal_review_approved_by = 'x'`)
    await expect(migration.down(args())).rejects.toThrow(/down refused/)
    await run(`UPDATE pages_locales SET legal_review_approved_by = NULL`)
    expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })

    // L1 licensing core (independent of this test) is part of the current Payload schema (locked-document rels, products, licenses).
    await ((await import('../../src/migrations')) as unknown as { migrations: Migration[] }).migrations.find((m) => m.name === '20261117_200700_licensing_core')!.up(args())
    // Rest of the setup on the migrated schema.
    await payload.create({ collection: 'users', overrideAccess: true, data: { ...ADMIN, name: 'Admin', roles: ['admin'], enableAPIKey: true, apiKey: API_KEY } as never })
    await payload.create({ collection: 'users', overrideAccess: true, data: { ...ADMIN2, name: 'Admin 2', roles: ['admin'] } as never })
    await payload.create({ collection: 'users', overrideAccess: true, data: { ...EDITOR, name: 'Editor', roles: ['editor'] } as never })
    await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { ...CUSTOMER, name: 'C', _verified: true } as never })
    jwt = { admin: await token('users', ADMIN), admin2: await token('users', ADMIN2), editor: await token('users', EDITOR), customer: await token('customers', CUSTOMER) }
  }, 240000)
})

describe('write-only secrets (admin panel session only)', () => {
  it('serializes simultaneous secret writes and hides short values', async () => {
    const { writeSecret, readIntegrationsDoc, secretStatus } = await import('../../src/lib/integrations/vault')
    await Promise.all([
      writeSecret(payload, 'iyzico.live.apiKey', '123456'),
      writeSecret(payload, 'iyzico.live.secretKey', 'abcdefghijklmnop'),
    ])
    const doc = await readIntegrationsDoc(payload)
    expect(secretStatus(doc, 'iyzico.live.apiKey').last4).toBeNull()
    expect(secretStatus(doc, 'iyzico.live.secretKey').last4).toBe('mnop')
    await writeSecret(payload, 'iyzico.live.apiKey', null)
    await writeSecret(payload, 'iyzico.live.secretKey', null)
    await run('UPDATE integrations SET secrets = NULL')
  })
  it('anonymous 401; customer, editor, API key (MCP), header JWT, missing/foreign origin 403; nothing stored', async () => {
    const body = { id: 'iyzico.sandbox.apiKey', value: PLAIN['iyzico.sandbox.apiKey'] }
    expect((await setSecret({ origin: ORIGIN }, body)).status).toBe(401)
    expect((await setSecret(panel(jwt.customer), body)).status).toBe(403)
    expect((await setSecret(panel(jwt.editor), body)).status).toBe(403)
    expect((await setSecret({ origin: ORIGIN, authorization: `users API-Key ${API_KEY}` }, body)).status).toBe(403)
    expect((await setSecret({ origin: ORIGIN, authorization: `JWT ${jwt.admin}` }, body)).status).toBe(403)
    expect((await setSecret({ cookie: `payload-token=${jwt.admin}` }, body)).status).toBe(403)
    expect((await setSecret({ origin: 'https://evil.example', cookie: `payload-token=${jwt.admin}` }, body)).status).toBe(403)
    expect((await setSecret({ ...panel(jwt.admin), 'sec-fetch-site': 'cross-site' }, body)).status).toBe(403)
    expect((await run('SELECT secrets FROM integrations')).rows[0]?.secrets ?? null).toBeNull()
  })

  it('admin panel: stores AES-GCM records and answers status only (never the value); bad input refused', async () => {
    const res = await setSecret(panel(jwt.admin), { id: 'iyzico.sandbox.apiKey', value: PLAIN['iyzico.sandbox.apiKey'] })
    expect(res.status).toBe(200)
    expect(JSON.parse(res.text)).toMatchObject({ code: 'ok', status: { defined: true, last4: '7781' } })
    noLeak(res.text)
    for (const id of ['iyzico.sandbox.secretKey', 'stripe.sandbox.secretKey', 'stripe.sandbox.webhookSecret'] as const) {
      expect((await setSecret(panel(jwt.admin), { id, value: PLAIN[id] })).status).toBe(200)
    }
    expect(JSON.parse((await setSecret(panel(jwt.admin), { id: 'stripe.sandbox.secretKey', value: 'sk_live_wrongenv' })).text)).toEqual({ code: 'invalid_format' })
    expect(JSON.parse((await setSecret(panel(jwt.admin), { id: 'nope', value: 'x' })).text)).toEqual({ code: 'unknown_secret' })
    // SMTP password needs a saved host first (it is bound to host + user).
    expect(JSON.parse((await setSecret(panel(jwt.admin), { id: 'smtp.password', value: PLAIN['smtp.password'] })).text)).toEqual({ code: 'smtp_host_required' })
    const raw = String((await run('SELECT secrets FROM integrations')).rows[0]!.secrets)
    expect(raw).toMatch(/sm1\.[0-9a-f]{12}\./)
    for (const value of Object.values(PLAIN)) expect(raw).not.toContain(value)
  })

  it('without SOFTMARKET_SECRETS_KEY a secret is never stored (fail-closed)', async () => {
    const key = process.env.SOFTMARKET_SECRETS_KEY
    delete process.env.SOFTMARKET_SECRETS_KEY
    try {
      const res = await setSecret(panel(jwt.admin), { id: 'iyzico.live.apiKey', value: 'live-never-stored-1' })
      expect(res.status).toBe(409)
      expect(JSON.parse(res.text)).toEqual({ code: 'no_key' })
    } finally {
      process.env.SOFTMARKET_SECRETS_KEY = key
    }
    expect(dbBytes().includes(Buffer.from('live-never-stored-1'))).toBe(false)
  })

  it('no role reads plaintext or ciphertext: REST, GraphQL, Local API (anonymous, customer, editor, admin, API key)', async () => {
    const get = (headers: Record<string, string>) => rest('GET', ['globals', 'integrations'], headers)
    expect((await get({})).status).toBe(403)
    expect((await get({ cookie: `payload-token=${jwt.customer}` })).status).toBe(403)
    expect((await get({ cookie: `payload-token=${jwt.editor}` })).status).toBe(403)
    for (const headers of [{ cookie: `payload-token=${jwt.admin}` }, { authorization: `users API-Key ${API_KEY}` }] as Record<string, string>[]) {
      const res = await get(headers)
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text)).not.toHaveProperty('secrets')
      noLeak(res.text)
    }
    const { GRAPHQL_POST } = await import('@payloadcms/next/routes')
    for (const auth of [{}, { cookie: `payload-token=${jwt.admin}` }, { authorization: `users API-Key ${API_KEY}` }] as Record<string, string>[]) {
      const res = await GRAPHQL_POST(await config())(new Request(`${ORIGIN}/api/graphql`, {
        method: 'POST', headers: { host: '127.0.0.1:3100', 'content-type': 'application/json', ...auth },
        body: JSON.stringify({ query: '{ Integration { secrets smtp { host } } }' }),
      }))
      noLeak(await res.text())
    }
    const admin = (await payload.find({ collection: 'users', where: { email: { equals: ADMIN.email } }, overrideAccess: true })).docs[0]!
    const editor = (await payload.find({ collection: 'users', where: { email: { equals: EDITOR.email } }, overrideAccess: true })).docs[0]!
    const local = await payload.findGlobal({ slug: 'integrations', overrideAccess: false, user: { ...admin, collection: 'users', _strategy: 'local-jwt' } as never })
    expect(local).not.toHaveProperty('secrets')
    noLeak(JSON.stringify(local))
    await expect(payload.findGlobal({ slug: 'integrations', overrideAccess: false, user: { ...editor, collection: 'users' } as never })).rejects.toThrow()
    await expect(payload.findGlobal({ slug: 'integrations', overrideAccess: false, user: null })).rejects.toThrow()
  })

  it('global update: secrets cannot be written through the document API; editor/API key cannot update; form saves keep the vault', async () => {
    const before = String((await run('SELECT secrets FROM integrations')).rows[0]!.secrets)
    const forged = { 'iyzico.sandbox.apiKey': { enc: 'sm1.forged', kid: 'x', last4: 'XXXX', updatedAt: '2020-01-01T00:00:00.000Z' } }
    expect((await rest('POST', ['globals', 'integrations'], { ...panel(jwt.editor) }, { secrets: forged })).status).toBe(403)
    expect((await rest('POST', ['globals', 'integrations'], { origin: ORIGIN, authorization: `users API-Key ${API_KEY}` }, { smtp: { host: 'evil.example' } })).status).toBe(403)
    // Admin form save (non-secret fields + a forged vault) → settings saved, vault untouched.
    const res = await rest('POST', ['globals', 'integrations'], panel(jwt.admin), { secrets: forged, smtp: { host: 'smtp.panel.test', port: 465, secure: true, user: 'mailer', fromAddress: 'shop@example.test', fromName: 'Shop' } })
    expect(res.status).toBe(200)
    noLeak(res.text)
    expect(String((await run('SELECT secrets FROM integrations')).rows[0]!.secrets)).toBe(before)
    expect((await run('SELECT smtp_host FROM integrations')).rows[0]!.smtp_host).toBe('smtp.panel.test')
  })

  it('switching a provider to live needs the extra confirmation (virtual, never stored)', async () => {
    const res = await rest('POST', ['globals', 'integrations'], panel(jwt.admin), { iyzico: { environment: 'live' } })
    expect(res.status).toBe(400)
    expect((await run('SELECT iyzico_environment FROM integrations')).rows[0]!.iyzico_environment).toBe('sandbox')
    const ok = await rest('POST', ['globals', 'integrations'], panel(jwt.admin), { iyzico: { environment: 'live', confirmLive: true } })
    expect(ok.status).toBe(200)
    expect((await run('SELECT iyzico_environment FROM integrations')).rows[0]!.iyzico_environment).toBe('live')
    expect((await run('PRAGMA table_info(integrations)')).rows.map((r) => r.name)).not.toContain('iyzico_confirm_live')
    expect((await rest('POST', ['globals', 'integrations'], panel(jwt.admin), { iyzico: { environment: 'sandbox' } })).status).toBe(200)
  })
})

describe('runtime: env precedence, provider keys, SMTP transport, test e-mail', () => {
  it('payments config: panel keys at runtime (capability on); env keys win; capability off never reads the DB', async () => {
    const { loadPaymentsConfig } = await import('../../src/lib/integrations/runtime')
    const findGlobal = vi.spyOn(payload, 'findGlobal')
    expect((await loadPaymentsConfig(payload, { SOFTMARKET_SECRETS_KEY: KEY })).iyzico).toBeUndefined()
    expect(findGlobal).not.toHaveBeenCalled()
    findGlobal.mockRestore()
    const panelCfg = await loadPaymentsConfig(payload, { SOFTMARKET_SECRETS_KEY: KEY, PAYMENTS_ENABLED: 'true', PAYMENTS_STRIPE_ENABLED: 'true' })
    expect(panelCfg.sources).toEqual({ iyzico: 'panel', stripe: 'panel' })
    expect(panelCfg.iyzico!.apiKey.reveal()).toBe(PLAIN['iyzico.sandbox.apiKey'])
    const envCfg = await loadPaymentsConfig(payload, { SOFTMARKET_SECRETS_KEY: KEY, PAYMENTS_ENABLED: 'true', IYZICO_API_KEY: 'env-a', IYZICO_SECRET_KEY: 'env-s', IYZICO_BASE_URL: 'https://sandbox-api.iyzipay.com' })
    expect(envCfg.sources.iyzico).toBe('env')
    expect(envCfg.iyzico!.apiKey.reveal()).toBe('env-a')

    const { loadPaymentsDeps } = await import('../../src/lib/payments/runtime')
    const auth: string[] = []
    const prev = { ...process.env }
    Object.assign(process.env, { PAYMENTS_ENABLED: 'true', PAYMENTS_STRIPE_ENABLED: 'true' })
    try {
      const deps = await loadPaymentsDeps(payload, { fetch: (async (_url: string, init: { headers: Record<string, string> }) => {
        auth.push(init.headers.Authorization)
        return { ok: true, status: 200, text: async () => '{"id":"cs_test_x","object":"checkout.session","status":"open","payment_status":"unpaid","metadata":{}}' }
      }) as never })
      await deps.providers.stripe!.retrieve('cs_test_x').catch(() => undefined)
    } finally {
      process.env = prev
    }
    expect(auth).toEqual([`Bearer ${PLAIN['stripe.sandbox.secretKey']}`])
  })

  it('SMTP from the panel: password bound to host/user; the transport is rebuilt on change; test e-mail = own address, rate limited', async () => {
    const { isEmailConfigured, softmarketEmailAdapter } = await import('../../src/lib/email/adapter')
    // Host + sender saved, no password stored: an unauthenticated relay is allowed (a stored but unreadable one is not).
    expect(await isEmailConfigured(payload, { SOFTMARKET_SECRETS_KEY: KEY })).toBe(true)
    expect((await setSecret(panel(jwt.admin), { id: 'smtp.password', value: PLAIN['smtp.password'] })).status).toBe(200)
    expect(await isEmailConfigured(payload, { SOFTMARKET_SECRETS_KEY: KEY })).toBe(true)

    const built: { host: string; user?: string; pass?: string }[] = []
    const delivered: { host: string; to: unknown; from: unknown }[] = []
    const adapter = softmarketEmailAdapter({
      env: { SOFTMARKET_SECRETS_KEY: KEY },
      createSender: async (cfg) => {
        built.push({ host: cfg.host, user: cfg.user, pass: cfg.password?.reveal() })
        return { send: async (m) => { delivered.push({ host: cfg.host, to: m.to, from: m.from }) } }
      },
    })({ payload })
    const original = payload.sendEmail
    payload.sendEmail = adapter.sendEmail as never
    try {
      await payload.sendEmail({ to: 'x@example.test', subject: 'a', text: 'a' })
      expect(built).toEqual([{ host: 'smtp.panel.test', user: 'mailer', pass: PLAIN['smtp.password'] }])

      // Test e-mail: editor/API key refused; admin → own address only; second within a minute → 429.
      expect((await testEmail(panel(jwt.editor))).status).toBe(403)
      expect((await testEmail({ origin: ORIGIN, authorization: `users API-Key ${API_KEY}` })).status).toBe(403)
      const sent = await testEmail(panel(jwt.admin))
      expect(sent.status).toBe(200)
      expect(JSON.parse(sent.text)).toEqual({ code: 'sent' })
      expect(delivered.at(-1)).toMatchObject({ to: ADMIN.email, host: 'smtp.panel.test' })
      expect((await testEmail(panel(jwt.admin))).status).toBe(429)
      expect((await testEmail(panel(jwt.admin2))).status).toBe(200)
      expect(delivered.at(-1)).toMatchObject({ to: ADMIN2.email })

      // Host change (same password record) → password unreadable → not configured, nothing sent.
      expect((await rest('POST', ['globals', 'integrations'], panel(jwt.admin), { smtp: { host: 'smtp.other.test' } })).status).toBe(200)
      expect(await isEmailConfigured(payload, { SOFTMARKET_SECRETS_KEY: KEY })).toBe(false)
      const count = delivered.length
      await expect(payload.sendEmail({ to: 'x@example.test', subject: 'b', text: 'b' })).rejects.toThrow('SMTP credentials unavailable')
      expect(delivered).toHaveLength(count)
      // Re-entered for the new host → a new transport is built and used.
      expect((await setSecret(panel(jwt.admin), { id: 'smtp.password', value: PLAIN['smtp.password'] })).status).toBe(200)
      await payload.sendEmail({ to: 'x@example.test', subject: 'c', text: 'c' })
      expect(built.map((b) => b.host)).toEqual(['smtp.panel.test', 'smtp.other.test'])
      expect(delivered.at(-1)).toMatchObject({ host: 'smtp.other.test' })

      // Env SMTP wins: the panel is not read at all.
      expect(await isEmailConfigured(payload, { SMTP_HOST: 'smtp.env.test', SMTP_FROM: 'env@example.test' })).toBe(true)
    } finally {
      payload.sendEmail = original
    }
  })

  it('clearing removes the record; the DB file never contains a plaintext secret', async () => {
    const res = await setSecret(panel(jwt.admin), { id: 'stripe.sandbox.webhookSecret', clear: true })
    expect(JSON.parse(res.text)).toMatchObject({ code: 'ok', status: { defined: false } })
    await run('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => undefined)
    const bytes = dbBytes()
    expect(bytes.length).toBeGreaterThan(0)
    for (const value of Object.values(PLAIN)) expect(bytes.includes(Buffer.from(value, 'utf8')), value).toBe(false)
  })
})

describe('legal approval + company placeholders (legalReady)', () => {
  const text = (t: string) => [{ blockType: 'richText', content: { root: { type: 'root', format: '', indent: 0, version: 1, direction: null, children: [
    { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [{ type: 'text', text: t, format: 0, mode: 'normal', style: '', detail: 0, version: 1 }] }] } } }]

  it('approval: admin panel only, bound to the text; company facts fill tokens; missing facts or approval → not ready', async () => {
    const { readLegalFacts } = await import('../../src/lib/commerce/legal-facts')
    const { loadCommerceLegalSet } = await import('../../src/lib/payments/contract')
    const users = (await payload.find({ collection: 'users', overrideAccess: true, limit: 10 })).docs
    const admin = { ...users.find((u) => u.email === ADMIN.email)!, collection: 'users', _strategy: 'local-jwt' }
    const editor = { ...users.find((u) => u.email === EDITOR.email)!, collection: 'users', _strategy: 'local-jwt' }
    const apiKeyAdmin = { ...admin, _strategy: 'api-key' }
    const body = 'Satıcı: [ŞİRKET UNVANI], [ADRES], MERSİS [MERSİS], [VERGİ DAİRESİ/NO], KEP [KEP], ETBİS [ETBİS NO], [TELEFON], [KVKK İLETİŞİM E-POSTASI].'
    const ids: number[] = []
    for (const kind of ['distanceSales', 'preInformation', 'refund'] as const) {
      const doc = await payload.create({ collection: 'pages', locale: 'tr', overrideAccess: false, user: editor as never, depth: 0,
        data: { title: kind, slug: `int-${kind}`, pageType: 'legal', commerceLegal: kind, layout: text(body), _status: 'published', legalReview: { approvedBy: 'Editor', approvedAt: '2026-11-17' } } as never })
      // Editor cannot record an approval (field access drops it).
      expect((doc as { legalReview?: { approvedBy?: unknown } }).legalReview?.approvedBy ?? null).toBeNull()
      await payload.update({ collection: 'pages', id: doc.id, locale: 'en', overrideAccess: false, user: editor as never, data: { title: `${kind}-en`, slug: `int-${kind}-en`, layout: (doc as { layout: unknown }).layout, _status: 'published' } as never })
      ids.push(doc.id as number)
    }
    const facts = async () => (await readLegalFacts(payload)).filter((f) => f.kind)
    expect((await facts()).every((f) => f.draft && !f.approved)).toBe(true)

    // API key admin (MCP) cannot approve either.
    await payload.update({ collection: 'pages', id: ids[0]!, locale: 'tr', overrideAccess: false, user: apiKeyAdmin as never, data: { legalReview: { approvedBy: 'Bot', approvedAt: '2026-11-17' } } as never })
    expect((await facts()).some((f) => f.approved)).toBe(false)

    // Admin panel approves both locales.
    for (const id of ids) for (const locale of ['tr', 'en'] as const) {
      await payload.update({ collection: 'pages', id, locale, overrideAccess: false, user: admin as never, data: { legalReview: { approvedBy: 'Av. Ayşe', approvedAt: '2026-11-17' } } as never })
    }
    expect((await facts()).every((f) => f.approved && f.draft)).toBe(true)
    expect(await loadCommerceLegalSet(payload, 'tr')).toBeNull()

    // Company facts (ETBİS missing) → tokens remain → still draft; complete → not draft, contract text filled.
    const company = { legalName: 'Örnek Yazılım A.Ş.', mersisNo: '0123456789012345', taxOffice: 'Kadıköy', taxNumber: '1234567890', kepAddress: 'ornek@hs01.kep.tr' }
    const contact = { address: 'Moda Cad. 1 Kadıköy', phone: '+90 212 000 00 00', email: 'kvkk@example.test' }
    await payload.updateGlobal({ slug: 'site-settings', locale: 'tr', overrideAccess: true, data: { company, contact } as never })
    await payload.updateGlobal({ slug: 'site-settings', locale: 'en', overrideAccess: true, data: { contact: { address: 'Moda St. 1 Kadikoy' } } as never })
    expect((await facts()).every((f) => f.draft)).toBe(true)
    await payload.updateGlobal({ slug: 'site-settings', locale: 'tr', overrideAccess: true, data: { company: { ...company, etbisNo: 'ETBIS-42' } } as never })
    const ready = await facts()
    expect(ready).toHaveLength(6)
    expect(ready.every((f) => !f.draft && f.approved)).toBe(true)
    const set = await loadCommerceLegalSet(payload, 'en')
    expect(set?.distanceSales.text).toContain('Örnek Yazılım A.Ş., Moda St. 1 Kadikoy')
    expect(set?.distanceSales.text).toContain('ETBİS ETBIS-42')
    // Stored page still has the tokens (render-time fill only).
    expect(JSON.stringify((await payload.findByID({ collection: 'pages', id: ids[0]!, locale: 'tr', overrideAccess: true })).layout)).toContain('[ŞİRKET UNVANI]')

    // An editor text change voids the approval (that locale only) until an admin re-approves with a new date.
    const page = await payload.findByID({ collection: 'pages', id: ids[2]!, locale: 'tr', overrideAccess: true, depth: 0 })
    const changed = (page.layout as unknown as Record<string, unknown>[]).map((b) => ({ ...b, content: text(`${body} Ek madde.`)[0]!.content }))
    await payload.update({ collection: 'pages', id: ids[2]!, locale: 'tr', overrideAccess: false, user: editor as never, data: { layout: changed, _status: 'published' } as never })
    expect((await facts()).find((f) => f.kind === 'refund' && f.locale === 'tr')!.approved).toBe(false)
    expect((await facts()).find((f) => f.kind === 'refund' && f.locale === 'en')!.approved).toBe(true)
    await payload.update({ collection: 'pages', id: ids[2]!, locale: 'tr', overrideAccess: false, user: admin as never, data: { legalReview: { approvedBy: 'Av. Ayşe', approvedAt: '2026-11-18' } } as never })
    expect((await facts()).every((f) => f.approved)).toBe(true)
  })
})

describe('no secret in logs, RSC output or admin status components', () => {
  it('server components pass status only; logs never carry a value', async () => {
    const { IntegrationSecret } = await import('../../src/admin/fields/integration-secret')
    const { IntegrationsStatus } = await import('../../src/admin/fields/integrations-status')
    const admin = (await payload.find({ collection: 'users', where: { email: { equals: ADMIN.email } }, overrideAccess: true })).docs[0]!
    const req = { user: { ...admin, collection: 'users', _strategy: 'local-jwt' } }
    const html: string[] = []
    for (const secretId of ['iyzico.sandbox.apiKey', 'iyzico.sandbox.secretKey', 'stripe.sandbox.secretKey', 'smtp.password']) {
      const element = await (IntegrationSecret as unknown as (p: unknown) => Promise<ReactElement | null>)({ payload, req, i18n: { language: 'tr' }, secretId })
      expect(element).not.toBeNull()
      noLeak(JSON.stringify(element!.props))
      html.push(renderToStaticMarkup(element!))
    }
    expect(html[0]).toContain('…7781')
    expect(html.join('')).toContain('Tanımlı')
    const status = await (IntegrationsStatus as unknown as (p: unknown) => Promise<ReactElement | null>)({ payload, req, i18n: { language: 'en' } })
    html.push(renderToStaticMarkup(status!))
    for (const h of html) noLeak(h)
    // Editors / API keys get nothing rendered.
    const editorEl = await (IntegrationSecret as unknown as (p: unknown) => Promise<unknown>)({ payload, req: { user: { ...req.user, roles: ['editor'] } }, i18n: { language: 'tr' }, secretId: 'iyzico.sandbox.apiKey' })
    expect(editorEl).toBeNull()
    expect(await (IntegrationSecret as unknown as (p: unknown) => Promise<unknown>)({ payload, req: { user: { ...req.user, _strategy: 'api-key' } }, i18n: { language: 'tr' }, secretId: 'iyzico.sandbox.apiKey' })).toBeNull()
    expect(createElement('div')).toBeTruthy()
    expect(logs.some((l) => l.includes('integrations: secret updated'))).toBe(true)
    noLeak(logs.join('\n'))
  })
})
