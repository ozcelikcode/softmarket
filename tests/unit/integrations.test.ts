import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { COMPANY_PLACEHOLDER_TOKENS, companyFactsFrom, fillLegalPlaceholders, missingCompanyFacts } from '../../src/lib/company-facts'
import { loadEmailConfig, PLACEHOLDER_FROM, softmarketEmailAdapter } from '../../src/lib/email/adapter'
import { validateSecretInput } from '../../src/lib/integrations/ids'
import { panelPaymentCredentials, resolvePaymentsConfig, resolveSmtpConfig, type SmtpConfig } from '../../src/lib/integrations/runtime'
import { secretBinding, secretStatus } from '../../src/lib/integrations/vault'
import { isLegalApproved, legalContentDigest, nextApprovalHash } from '../../src/lib/legal-approval'
import { isLegalDraft } from '../../src/lib/legal-draft'
import { evaluateLegal } from '../../src/lib/payments/legal'
import { createConfiguredProviders } from '../../src/lib/payments/providers'
import { readPaymentsConfig } from '../../src/lib/payments/env'
import { SecretValue } from '../../src/lib/payments/secret'
import { iyzicoAuthorizationHeader } from '../../src/lib/payments/signature/iyzico'
import { decryptSecret, encryptSecret, readSecretsKey, SecretsError } from '../../src/lib/secrets/crypto'
import { mcpGlobals } from '../../src/lib/mcp'
import { readLegalFacts } from '../../src/lib/commerce/legal-facts'
import { loadCommerceLegalSet } from '../../src/lib/payments/contract'

/*
 * Entegrasyon ayarları (pure): AES-GCM vault, write-only status, env → panel precedence, provider runtime with panel
 * keys (fake fetch), runtime SMTP transport switch (fake sender), company placeholders + lawyer approval, client
 * import graph. DB/access/endpoint/leak checks live in integrations-db.test.ts.
 */

const KEY_A = Buffer.alloc(32, 7).toString('base64')
const KEY_B = Buffer.alloc(32, 9).toString('base64')
const keyA = readSecretsKey({ SOFTMARKET_SECRETS_KEY: KEY_A })!
const keyB = readSecretsKey({ SOFTMARKET_SECRETS_KEY: KEY_B })!
const SECRET = 'sk_test_INTEGRATION_PLAINTEXT_4242'

it('keeps legal readiness closed with missing company facts even when text has no placeholders', async () => {
  const layout = [{ blockType: 'richText', content: { root: { children: [{ type: 'text', text: 'Approved terms.' }] } } }]
  const doc = { commerceLegal: 'refund', title: 'Terms', slug: 'terms', updatedAt: '2026-11-17', layout,
    legalReview: { approvedBy: 'Lawyer', approvedAt: '2026-11-17', approvedHash: legalContentDigest('Terms', layout) } }
  const payload = { find: vi.fn().mockResolvedValue({ docs: [doc] }), findGlobal: vi.fn().mockResolvedValue({}) } as unknown as Payload
  expect((await readLegalFacts(payload)).every((fact) => fact.draft && fact.approved)).toBe(true)
  expect(await loadCommerceLegalSet(payload, 'tr')).toBeNull()
})

it('binds approval to visible paragraph and line breaks', () => {
  const layout = (children: unknown[]) => [{ blockType: 'richText', content: { root: { children } } }]
  const text = (value: string) => ({ type: 'text', text: value })
  const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children })
  expect(legalContentDigest('T', layout([paragraph(text('ab'))])))
    .not.toBe(legalContentDigest('T', layout([paragraph(text('a')), paragraph(text('b'))])))
  expect(legalContentDigest('T', layout([paragraph(text('ab'))])))
    .not.toBe(legalContentDigest('T', layout([paragraph(text('a'), { type: 'linebreak' }, text('b'))])))
})

describe('secrets crypto (AES-256-GCM, kid, AAD, fail-closed)', () => {
  it('reads the key only from SOFTMARKET_SECRETS_KEY (>= 32 bytes, base64/base64url/hex); placeholders/short = none', () => {
    expect(keyA.kid).toMatch(/^[0-9a-f]{12}$/)
    expect(keyA.kid).not.toBe(keyB.kid)
    expect(readSecretsKey({ SOFTMARKET_SECRETS_KEY: 'a'.repeat(64) })?.kid).toMatch(/^[0-9a-f]{12}$/)
    expect(readSecretsKey({ SOFTMARKET_SECRETS_KEY: Buffer.alloc(32, 7).toString('base64url') })?.kid).toBe(keyA.kid)
    for (const value of [undefined, '', 'CHANGE_ME_SECRETS_KEY_xxxxxxxxxxxxxxxxxxxxxxxxxxxx', Buffer.alloc(16, 1).toString('base64'), 'not base64 !!']) {
      expect(readSecretsKey({ SOFTMARKET_SECRETS_KEY: value })).toBeNull()
    }
    // Never derived from PAYLOAD_SECRET.
    expect(readSecretsKey({ PAYLOAD_SECRET: 'x'.repeat(64) })).toBeNull()
    expect(readSecretsKey({ SOFTMARKET_SECRETS_KEY: `${KEY_A}A` })).toBeNull()
  })

  it('round-trips, never repeats an IV and never contains the plaintext', () => {
    const records = Array.from({ length: 200 }, () => encryptSecret(SECRET, 'stripe.sandbox.secretKey', keyA))
    const ivs = new Set(records.map((r) => r.split('.')[2]))
    expect(ivs.size).toBe(200)
    expect(new Set(records).size).toBe(200)
    for (const r of records.slice(0, 5)) {
      expect(r).toMatch(/^sm1\.[0-9a-f]{12}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/)
      expect(r).not.toContain('INTEGRATION_PLAINTEXT')
      expect(decryptSecret(r, 'stripe.sandbox.secretKey', keyA).reveal()).toBe(SECRET)
    }
  })

  it('wrong key, tampered ciphertext/tag/iv, moved record (AAD) or missing key → error with a fixed code only', () => {
    const record = encryptSecret(SECRET, 'stripe.sandbox.secretKey', keyA)
    const code = (fn: () => unknown) => {
      try {
        fn()
        return 'none'
      } catch (error) {
        expect(error).toBeInstanceOf(SecretsError)
        expect(String((error as Error).message)).not.toContain(SECRET)
        return (error as SecretsError).code
      }
    }
    expect(code(() => decryptSecret(record, 'stripe.sandbox.secretKey', keyB))).toBe('wrong_key')
    // Same kid but different material is impossible to forge here; a forged kid still fails the GCM tag.
    const [f, , iv, ct, tag] = record.split('.')
    expect(code(() => decryptSecret([f, keyB.kid, iv, ct, tag].join('.'), 'stripe.sandbox.secretKey', keyB))).toBe('tampered')
    const flip = (s: string) => (s[0] === 'A' ? 'B' : 'A') + s.slice(1)
    expect(code(() => decryptSecret([f, keyA.kid, iv, flip(ct!), tag].join('.'), 'stripe.sandbox.secretKey', keyA))).toBe('tampered')
    expect(code(() => decryptSecret([f, keyA.kid, iv, ct, flip(tag!)].join('.'), 'stripe.sandbox.secretKey', keyA))).toBe('tampered')
    expect(code(() => decryptSecret([f, keyA.kid, flip(iv!), ct, tag].join('.'), 'stripe.sandbox.secretKey', keyA))).toBe('tampered')
    expect(code(() => decryptSecret(record, 'stripe.live.secretKey', keyA))).toBe('tampered')
    expect(code(() => decryptSecret([f, 'é'.repeat(12), iv, ct, tag].join('.'), 'stripe.sandbox.secretKey', keyA))).toBe('wrong_key')
    expect(code(() => decryptSecret('garbage', 'stripe.sandbox.secretKey', keyA))).toBe('malformed')
    expect(code(() => decryptSecret(record, 'stripe.sandbox.secretKey', null))).toBe('no_key')
    expect(code(() => encryptSecret(SECRET, 'stripe.sandbox.secretKey', null))).toBe('no_key')
  })

  it('SecretValue never prints', () => {
    const value = decryptSecret(encryptSecret(SECRET, 'x', keyA), 'x', keyA)
    expect(`${value}`).toBe('[REDACTED]')
    expect(JSON.stringify({ value })).not.toContain(SECRET)
  })
})

describe('input validation and write-only status', () => {
  it('checks format per field/environment and never echoes the value', () => {
    expect(validateSecretInput('stripe.sandbox.secretKey', 'sk_test_abc')).toBe('ok')
    expect(validateSecretInput('stripe.sandbox.secretKey', 'sk_live_abc')).toBe('invalid_format')
    expect(validateSecretInput('stripe.live.secretKey', 'rk_live_abc')).toBe('ok')
    expect(validateSecretInput('stripe.live.webhookSecret', 'abc')).toBe('invalid_format')
    expect(validateSecretInput('iyzico.sandbox.apiKey', 'has space')).toBe('invalid_chars')
    expect(validateSecretInput('iyzico.sandbox.apiKey', '')).toBe('empty')
    expect(validateSecretInput('iyzico.sandbox.apiKey', 'CHANGE_ME')).toBe('invalid_format')
    expect(validateSecretInput('iyzico.sandbox.apiKey', 'x'.repeat(513))).toBe('too_long')
    expect(validateSecretInput('smtp.password', 'pass with spaces!')).toBe('ok')
  })

  it('status = set · last 4 · updated, readable only with the right key; SMTP password bound to host/user', () => {
    const doc = { smtp: { host: 'smtp.a.test', user: 'u' }, secrets: {
      'iyzico.sandbox.apiKey': { enc: encryptSecret('sandbox-key-1234', 'iyzico.sandbox.apiKey', keyA), kid: keyA.kid, last4: '1234', updatedAt: '2026-11-17T10:00:00.000Z' },
      'smtp.password': { enc: encryptSecret('pw', secretBinding('smtp.password', { smtp: { host: 'smtp.a.test', user: 'u' } }), keyA), kid: keyA.kid, last4: null, updatedAt: '2026-11-17T10:00:00.000Z' },
    } }
    expect(secretStatus(doc, 'iyzico.sandbox.apiKey', keyA)).toEqual({ defined: true, last4: '1234', updatedAt: '2026-11-17T10:00:00.000Z' })
    expect(secretStatus(doc, 'iyzico.sandbox.apiKey', keyB)).toMatchObject({ defined: true, unreadable: true })
    expect(secretStatus(doc, 'iyzico.live.apiKey', keyA)).toEqual({ defined: false, last4: null, updatedAt: null })
    expect(secretStatus(doc, 'smtp.password', keyA)).toEqual({ defined: true, last4: null, updatedAt: '2026-11-17T10:00:00.000Z' })
    expect(secretStatus({ ...doc, smtp: { host: 'evil.example', user: 'u' } }, 'smtp.password', keyA)).toMatchObject({ unreadable: true })
    expect(JSON.stringify(secretStatus(doc, 'iyzico.sandbox.apiKey', keyA))).not.toContain('sm1.')
  })
})

const vaultDoc = (entries: Record<string, string>, extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const doc: Record<string, unknown> = { ...extra }
  const secrets: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(entries)) {
    secrets[id] = { enc: encryptSecret(value, secretBinding(id as never, doc), keyA), kid: keyA.kid, last4: value.slice(-4), updatedAt: '2026-11-17T00:00:00.000Z' }
  }
  return { ...doc, secrets }
}
const PANEL_ENV = { SOFTMARKET_SECRETS_KEY: KEY_A, PAYMENTS_ENABLED: 'true' }

describe('env → panel precedence (per provider) and allow-listed base URLs', () => {
  const iyzicoDoc = vaultDoc({ 'iyzico.sandbox.apiKey': 'sandbox-api', 'iyzico.sandbox.secretKey': 'sandbox-secret', 'iyzico.live.apiKey': 'live-api', 'iyzico.live.secretKey': 'live-secret' }, { iyzico: { environment: 'sandbox' } })

  it('panel keys of the SELECTED environment are used; the base URL is the allow-listed constant', () => {
    const cfg = resolvePaymentsConfig(PANEL_ENV, iyzicoDoc)
    expect(cfg.sources.iyzico).toBe('panel')
    expect(cfg.iyzico).toMatchObject({ env: 'sandbox', baseUrl: 'https://sandbox-api.iyzipay.com' })
    expect(cfg.iyzico!.apiKey.reveal()).toBe('sandbox-api')
    const live = resolvePaymentsConfig(PANEL_ENV, { ...iyzicoDoc, iyzico: { environment: 'live' } })
    expect(live.iyzico).toMatchObject({ env: 'live', baseUrl: 'https://api.iyzipay.com' })
    expect(live.iyzico!.secretKey.reveal()).toBe('live-secret')
    // Anything not exactly `live` is sandbox (no free-form URL can be stored).
    expect(resolvePaymentsConfig(PANEL_ENV, { ...iyzicoDoc, iyzico: { environment: 'https://evil.example' } }).iyzico!.baseUrl).toBe('https://sandbox-api.iyzipay.com')
  })

  it('any env variable of a provider wins over the panel (panel ignored); CHANGE_ placeholders do not count', () => {
    const env = { ...PANEL_ENV, IYZICO_API_KEY: 'env-api', IYZICO_SECRET_KEY: 'env-secret', IYZICO_BASE_URL: 'https://api.iyzipay.com' }
    const cfg = resolvePaymentsConfig(env, iyzicoDoc)
    expect(cfg.sources.iyzico).toBe('env')
    expect(cfg.iyzico!.apiKey.reveal()).toBe('env-api')
    // A partial env definition still wins (reported missing, panel not mixed in).
    const partial = resolvePaymentsConfig({ ...PANEL_ENV, IYZICO_API_KEY: 'env-api' }, iyzicoDoc)
    expect(partial.iyzico).toBeUndefined()
    expect(partial.issues).toEqual(expect.arrayContaining(['IYZICO_SECRET_KEY', 'IYZICO_BASE_URL']))
    expect(resolvePaymentsConfig({ ...PANEL_ENV, IYZICO_API_KEY: 'CHANGE_ME' }, iyzicoDoc).sources.iyzico).toBe('panel')
  })

  it('wrong key / tampered panel record → provider missing with an id+code issue, never a value', () => {
    const cfg = resolvePaymentsConfig({ ...PANEL_ENV, SOFTMARKET_SECRETS_KEY: KEY_B }, iyzicoDoc)
    expect(cfg.iyzico).toBeUndefined()
    expect(cfg.issues).toEqual(expect.arrayContaining(['panel:iyzico.sandbox.apiKey (wrong_key)']))
    expect(JSON.stringify(cfg.issues)).not.toMatch(/sandbox-api|sandbox-secret/)
  })

  it('Stripe from the panel needs PAYMENTS_STRIPE_ENABLED and keys matching the selected environment', () => {
    const doc = vaultDoc({ 'stripe.sandbox.secretKey': 'sk_test_panel', 'stripe.sandbox.webhookSecret': 'whsec_panel' }, { stripe: { environment: 'sandbox' } })
    expect(resolvePaymentsConfig(PANEL_ENV, doc).stripe).toBeUndefined()
    const cfg = resolvePaymentsConfig({ ...PANEL_ENV, PAYMENTS_STRIPE_ENABLED: 'true' }, doc)
    expect(cfg).toMatchObject({ sources: { stripe: 'panel' }, stripe: { env: 'sandbox', apiBase: 'https://api.stripe.com' } })
    const mismatch = readPaymentsConfig({ env: { PAYMENTS_STRIPE_ENABLED: 'true' }, panel: { stripe: { env: 'live', secretKey: new SecretValue('sk_test_x'), webhookSecret: new SecretValue('whsec_x') } } })
    expect(mismatch.stripe).toBeUndefined()
    expect(mismatch.issues).toContain('panel:stripe.live.secretKey')
  })

  it('panel credentials are taken only for the selected environment', () => {
    const creds = panelPaymentCredentials(vaultDoc({ 'iyzico.live.apiKey': 'l', 'iyzico.live.secretKey': 'l2' }, { iyzico: { environment: 'sandbox' } }), keyA)
    expect(creds.iyzico).toBeUndefined()
  })
})

describe('provider runtime uses the panel key (fake fetch, no network)', () => {
  it('Stripe calls carry the decrypted panel key only in the Authorization header', async () => {
    const doc = vaultDoc({ 'stripe.sandbox.secretKey': 'sk_test_PANELKEY', 'stripe.sandbox.webhookSecret': 'whsec_PANEL' }, { stripe: { environment: 'sandbox' } })
    const cfg = resolvePaymentsConfig({ ...PANEL_ENV, PAYMENTS_STRIPE_ENABLED: 'true' }, doc)
    const calls: { url: string; headers: Record<string, string> }[] = []
    const fetch = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, headers: init.headers })
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'cs_test_1', object: 'checkout.session', status: 'open', payment_status: 'unpaid', metadata: {} }) }
    })
    const providers = createConfiguredProviders(cfg, fetch as never)
    expect(Object.keys(providers)).toEqual(['stripe'])
    await providers.stripe!.retrieve('cs_test_1').catch(() => undefined)
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0]!.url.startsWith('https://api.stripe.com/')).toBe(true)
    expect(calls[0]!.headers.Authorization ?? calls[0]!.headers.authorization).toBe('Bearer sk_test_PANELKEY')
  })

  it('iyzico sandbox panel keys sign requests to the sandbox host', async () => {
    const doc = vaultDoc({ 'iyzico.sandbox.apiKey': 'sandbox-PANELAPI', 'iyzico.sandbox.secretKey': 'sandbox-PANELSECRET' }, { iyzico: { environment: 'sandbox' } })
    const cfg = resolvePaymentsConfig(PANEL_ENV, doc)
    const urls: string[] = []
    const auth: string[] = []
    const bodies: string[] = []
    const fetch = vi.fn(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
      urls.push(url)
      bodies.push(init.body ?? '')
      auth.push(init.headers.Authorization ?? init.headers.authorization ?? '')
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'failure', errorCode: '1' }) }
    })
    const providers = createConfiguredProviders(cfg, fetch as never)
    await providers.iyzico!.retrieve('tokPANEL0000000000000001Zz', { orderNumber: 'SM-1', locale: 'tr' }).catch(() => undefined)
    expect(urls[0]!.startsWith('https://sandbox-api.iyzipay.com/')).toBe(true)
    expect(auth[0]).toMatch(/^IYZWSv2 /)
    const decoded = Buffer.from(auth[0]!.slice(8), 'base64').toString()
    expect(decoded).toContain('apiKey:sandbox-PANELAPI')
    expect(decoded).not.toContain('PANELSECRET')
    // The signature was made with the decrypted panel secret key.
    const randomKey = /randomKey:([^&]+)/.exec(decoded)![1]!
    expect(auth[0]).toBe(iyzicoAuthorizationHeader({ apiKey: 'sandbox-PANELAPI', secretKey: 'sandbox-PANELSECRET', randomKey, uriPath: new URL(urls[0]!).pathname, body: bodies[0]! }))
  })
})

describe('SMTP: env first, panel next, runtime transport switch', () => {
  const smtpDoc = (host: string, password = 'smtp-PASSWORD-1') => vaultDoc({ 'smtp.password': password }, { smtp: { host, port: 465, secure: true, user: 'mailer', fromAddress: 'shop@example.test', fromName: 'Shop' } })

  it('does not report a successful console send for unreadable stored credentials', async () => {
    const doc = smtpDoc('smtp.panel.test')
    const payload = { findGlobal: vi.fn().mockResolvedValue(doc) } as unknown as Payload
    await expect(loadEmailConfig(payload, { SOFTMARKET_SECRETS_KEY: KEY_B })).rejects.toThrow('SMTP credentials unavailable')
  })

  it('resolves env (unchanged rule) before the panel; host/user change makes the stored password unusable', () => {
    expect(resolveSmtpConfig({ SMTP_HOST: 'smtp.env.test', SMTP_FROM: 'e@x.test', SOFTMARKET_SECRETS_KEY: KEY_A }, smtpDoc('smtp.panel.test'))).toMatchObject({ source: 'env', host: 'smtp.env.test' })
    expect(resolveSmtpConfig({ SMTP_HOST: 'smtp.env.test', SOFTMARKET_SECRETS_KEY: KEY_A }, smtpDoc('smtp.panel.test'))).toBeNull()
    const panel = resolveSmtpConfig({ SMTP_HOST: 'CHANGE_ME', SOFTMARKET_SECRETS_KEY: KEY_A }, smtpDoc('smtp.panel.test'))
    expect(panel).toMatchObject({ source: 'panel', host: 'smtp.panel.test', port: 465, secure: true, user: 'mailer', fromAddress: 'shop@example.test' })
    expect(panel!.password!.reveal()).toBe('smtp-PASSWORD-1')
    expect(JSON.stringify(panel)).not.toContain('smtp-PASSWORD-1')
    const doc = smtpDoc('smtp.panel.test')
    expect(resolveSmtpConfig({ SOFTMARKET_SECRETS_KEY: KEY_A }, { ...doc, smtp: { ...(doc.smtp as object), host: 'attacker.example' } })).toBeNull()
    expect(resolveSmtpConfig({ SOFTMARKET_SECRETS_KEY: KEY_B }, doc)).toBeNull()
    expect(resolveSmtpConfig({}, { smtp: { host: 'h.test' } })).toBeNull()
  })

  it('rebuilds the transport when the settings change and sends with the configured sender; no config → log only', async () => {
    let config: SmtpConfig | null = resolveSmtpConfig({ SOFTMARKET_SECRETS_KEY: KEY_A }, smtpDoc('smtp.one.test'))
    const built: { host: string; pass?: string }[] = []
    const sent: { host: string; message: Record<string, unknown> }[] = []
    const closed: string[] = []
    const adapter = softmarketEmailAdapter({
      loadConfig: async () => config,
      createSender: async (cfg) => {
        built.push({ host: cfg.host, pass: cfg.password?.reveal() })
        return { send: async (message) => { sent.push({ host: cfg.host, message: message as Record<string, unknown> }) }, close: () => closed.push(cfg.host) }
      },
    })
    const logger = { info: vi.fn() }
    const email = adapter({ payload: { logger } as unknown as Payload })
    expect(email.defaultFromAddress).toBe(PLACEHOLDER_FROM)
    await email.sendEmail({ to: 'a@example.test', subject: 'S1', text: 'x', from: `"SoftMarket" <${PLACEHOLDER_FROM}>` })
    await email.sendEmail({ to: 'a@example.test', subject: 'S2', text: 'x' })
    expect(built).toEqual([{ host: 'smtp.one.test', pass: 'smtp-PASSWORD-1' }])
    expect(sent[0]!.message.from).toBeUndefined()
    config = resolveSmtpConfig({ SOFTMARKET_SECRETS_KEY: KEY_A }, smtpDoc('smtp.two.test', 'smtp-PASSWORD-2'))
    await email.sendEmail({ to: 'a@example.test', subject: 'S3', text: 'x' })
    expect(built.map((b) => b.host)).toEqual(['smtp.one.test', 'smtp.two.test'])
    expect(sent.map((s) => s.host)).toEqual(['smtp.one.test', 'smtp.one.test', 'smtp.two.test'])
    await vi.waitFor(() => expect(closed).toEqual(['smtp.one.test']))
    config = null
    await email.sendEmail({ to: 'a@example.test', subject: 'S4', text: 'BODY-NOT-LOGGED' })
    expect(sent).toHaveLength(3)
    expect(JSON.stringify(logger.info.mock.calls)).toContain('S4')
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('BODY-NOT-LOGGED')
  })

  it('a settings read error throws (queue retries) instead of sending', async () => {
    const adapter = softmarketEmailAdapter({ env: {} })
    const email = adapter({ payload: { logger: { info: vi.fn() }, findGlobal: async () => { throw new Error('db') } } as unknown as Payload })
    await expect(email.sendEmail({ to: 'a@example.test', subject: 'x', text: 'x' })).rejects.toThrow('email: settings unavailable')
  })
})

describe('company placeholders and lawyer approval (legalReady)', () => {
  const text = (t: string) => [{ blockType: 'richText', content: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: t }] }] } } }]
  const full = companyFactsFrom({
    company: { legalName: 'Örnek Yazılım A.Ş.', mersisNo: '0123456789012345', taxOffice: 'Kadıköy', taxNumber: '1234567890', kepAddress: 'ornek@hs01.kep.tr', etbisNo: 'ETBIS-1' },
    contact: { address: 'Moda Cad. 1\nKadıköy İstanbul', phone: '+90 212 000 00 00', email: 'kvkk@example.test' },
  })

  it('fills every company token in text nodes only; a missing value keeps its token → still a draft', () => {
    const source = text(`Satıcı: [ŞİRKET UNVANI], [ADRES], MERSİS [MERSİS], [VERGİ DAİRESİ/NO], KEP [KEP], ETBİS [ETBİS NO], Tel [TELEFON], [KVKK İLETİŞİM E-POSTASI]`)
    const filled = fillLegalPlaceholders(source, full)
    expect(JSON.stringify(filled)).toContain('Örnek Yazılım A.Ş., Moda Cad. 1, Kadıköy İstanbul, MERSİS 0123456789012345, Kadıköy / 1234567890')
    expect(isLegalDraft(filled)).toBe(false)
    expect(isLegalDraft(source)).toBe(true)
    expect(JSON.stringify(source)).toContain('[ŞİRKET UNVANI]')
    const partial = { ...full, etbisNo: undefined }
    expect(isLegalDraft(fillLegalPlaceholders(source, partial))).toBe(true)
    expect(missingCompanyFacts(partial)).toEqual(['etbisNo'])
    expect(missingCompanyFacts(companyFactsFrom({ company: { legalName: 'CHANGE_ME', mersisNo: '[MERSİS]' } }))).toEqual(expect.arrayContaining(['legalName', 'mersisNo']))
    expect(COMPANY_PLACEHOLDER_TOKENS).toHaveLength(8)
    // Non-company placeholders (lawyer work) are never filled.
    expect(isLegalDraft(fillLegalPlaceholders(text('[YÜRÜRLÜK TARİHİ]'), full))).toBe(true)
  })

  it('approval is bound to title + visible text; any text change voids it; restamped only on a new approval', () => {
    const layout = text('Temiz metin.')
    const hash = nextApprovalHash({ review: { approvedBy: 'Av. A', approvedAt: '2026-11-17' }, previous: null, title: 'T', layout })!
    expect(hash).toBe(legalContentDigest('T', layout))
    expect(isLegalApproved({ title: 'T', layout, legalReview: { approvedBy: 'Av. A', approvedAt: '2026-11-17', approvedHash: hash } })).toBe(true)
    expect(isLegalApproved({ title: 'T', layout: text('Değişti.'), legalReview: { approvedBy: 'Av. A', approvedAt: '2026-11-17', approvedHash: hash } })).toBe(false)
    expect(isLegalApproved({ title: 'T2', layout, legalReview: { approvedBy: 'Av. A', approvedAt: '2026-11-17', approvedHash: hash } })).toBe(false)
    expect(isLegalApproved({ title: 'T', layout, legalReview: { approvedBy: '', approvedAt: '2026-11-17', approvedHash: hash } })).toBe(false)
    expect(isLegalApproved({ title: 'T', layout })).toBe(false)
    // Same approval re-saved with changed text keeps the OLD digest (not approved); a new date re-approves.
    const previous = { approvedBy: 'Av. A', approvedAt: '2026-11-17T00:00:00.000Z', approvedHash: hash }
    expect(nextApprovalHash({ review: { approvedBy: 'Av. A', approvedAt: '2026-11-17T00:00:00.000Z' }, previous, title: 'T', layout: text('Yeni.') })).toBe(hash)
    expect(nextApprovalHash({ review: { approvedBy: 'Av. A', approvedAt: '2026-11-18' }, previous, title: 'T', layout: text('Yeni.') })).toBe(legalContentDigest('T', text('Yeni.')))
    expect(nextApprovalHash({ review: { approvedBy: '', approvedAt: '2026-11-18' }, previous, title: 'T', layout })).toBeNull()
    expect(nextApprovalHash({ review: {}, previous: {}, title: 'T', layout })).toBeUndefined()
    // Company values are filled at render: the approval digest uses the stored tokens and survives a company edit.
    expect(legalContentDigest('T', text('[ŞİRKET UNVANI]'))).toBe(legalContentDigest('T', text('[ŞİRKET UNVANI]')))
  })

  it('legalReady = published + not draft (after filling) + approved, per kind and locale', () => {
    const facts = (approved: boolean) => (['distanceSales', 'preInformation', 'refund'] as const).flatMap((kind) => (['tr', 'en'] as const).map((locale) => ({ kind, locale, published: true, draft: false, approved })))
    expect(evaluateLegal(facts(true)).ready).toBe(true)
    expect(evaluateLegal(facts(false)).ready).toBe(false)
  })
})

describe('server-only boundary', () => {
  it('MCP never exposes the integrations global', () => {
    expect(Object.keys(mcpGlobals)).not.toContain('integrations')
  })

  it('no client component (transitively) imports the vault, crypto, runtime resolver, endpoints or the email adapter', () => {
    const SRC = join(process.cwd(), 'src')
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
    })
    const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    const resolveImport = (from: string, spec: string): string | null => {
      const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
      if (!base) return null
      for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) if (existsSync(c) && statSync(c).isFile()) return c
      return null
    }
    const importsOf = (file: string) => {
      const code = strip(readFileSync(file, 'utf8'))
      return [
        ...[...code.matchAll(/^\s*(?:import|export)(?!\s+type\b)[^'"]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
        ...[...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
      ].map((s) => resolveImport(file, s)).filter((p): p is string => p !== null)
    }
    const roots = walk(SRC).filter((p) => /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8')))
    expect(roots.some((p) => p.endsWith('integration-secret-client.tsx'))).toBe(true)
    const seen = new Set<string>()
    const queue = [...roots]
    while (queue.length) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      if (/^\s*['"]use server['"]/.test(readFileSync(file, 'utf8')) && !roots.includes(file)) continue
      queue.push(...importsOf(file))
    }
    const rel = [...seen].map((p) => p.slice(SRC.length + 1))
    expect(rel.filter((p) => /^(lib\/secrets\/|lib\/integrations\/(vault|runtime|endpoints)|lib\/email\/adapter|globals\/Integrations)/.test(p))).toEqual([])
  })
})
