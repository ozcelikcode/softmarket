import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { JWT_AUTH_VERSION, type AuthStrategy, type PayloadRequest } from 'payload'

import { Customers } from '@/collections/Customers'
import { licenseState, maskLicenseKey } from '@/lib/licenses/state'
import { readCookie } from '@/lib/portal/cookie'
import { allowAuthAttempt, sameOrigin } from '@/lib/portal/guard'
import { KVKK_CONSENT_VERSION } from '@/lib/portal/policy'
import { portalCookieStrategy } from '@/lib/portal/strategy'
import { canonicalPortalPath, sanitizeNext } from '@/lib/portal/redirect'
import {
  PROFILE_FIELDS,
  passwordChangeSchema,
  pickProfileUpdate,
  registerSchema,
  replySchema,
  ticketSchema,
} from '@/lib/portal/schemas'

describe('sanitizeNext (open redirect)', () => {
  it.each([
    'https://evil.com', '//evil.com', '/\\evil.com', '\\\\evil.com', 'javascript:alert(1)', '/hesap/../admin',
    '/%2f%2fevil.com', '/hesap/%2e%2e/admin', '/admin', '/api/customers', '/hesap/giris', '/en/account/login',
    '/hesap\n/x', ' //evil.com', '/' + 'a'.repeat(400), '', null, undefined, 42, '/hesapx',
    '/hesap/../..', '/hesap/lisanslar/../profil', '/hesap/%252f%252fevil.com', '/hesap/／／evil.com',
    '/hesap/\u202eevil.com', '/en/account/tickets/0', '/hesap/./profil', '/hesap/profil/anything',
  ])('falls back to /hesap for %j', (value) => {
    expect(sanitizeNext(value)).toBe('/hesap')
  })

  it('keeps portal paths and maps English segments to canonical', () => {
    expect(sanitizeNext('/hesap/lisanslar')).toBe('/hesap/lisanslar')
    expect(sanitizeNext('/en/account/tickets/12')).toBe('/hesap/talepler/12')
    expect(sanitizeNext('/tr/hesap/talepler/yeni?x=1')).toBe('/hesap/talepler/yeni?x=1')
    expect(sanitizeNext('/hesap/lisanslar?a=<b>')).toBe('/hesap/lisanslar')
  })

  it('canonicalPortalPath is locale free', () => {
    expect(canonicalPortalPath('/en/account/downloads')).toBe('/hesap/indirmeler')
    expect(canonicalPortalPath('/tr/hesap')).toBe('/hesap')
  })
})

describe('profile allow-list', () => {
  it('permits only name/company/phone/taxNumber', () => {
    expect([...PROFILE_FIELDS]).toEqual(['name', 'company', 'phone', 'taxNumber'])
  })
  it('drops email, roles, verification and any other injected field', () => {
    const out = pickProfileUpdate({
      name: 'Ada Lovelace', company: 'X', phone: '+90 555 000 00 00', taxNumber: '1234567890',
      email: 'evil@example.com', roles: ['admin'], _verified: true, password: 'x', notes: 'x', id: 9, collection: 'users',
    })
    expect(Object.keys(out).sort()).toEqual([...PROFILE_FIELDS].sort())
  })
  it('validates formats', () => {
    expect(() => pickProfileUpdate({ name: 'A', company: '', phone: '', taxNumber: '' })).toThrow()
    expect(() => pickProfileUpdate({ name: 'Ada', company: '', phone: '', taxNumber: 'abc' })).toThrow()
    expect(() => pickProfileUpdate({ name: 'Ada', company: '', phone: 'call me', taxNumber: '' })).toThrow()
    expect(pickProfileUpdate({ name: ' Ada ', company: '', phone: '', taxNumber: '12345678901' }).name).toBe('Ada')
  })
})

describe('license mask and state', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const day = 86_400_000
  const at = (d: number) => new Date(now.getTime() + d * day).toISOString()
  it('masks all but the last group', () => {
    expect(maskLicenseKey('ABCDE-FGHIJ-KLMNO-PQRST-UVWXY')).toBe('•••••-•••••-•••••-•••••-UVWXY')
    expect(maskLicenseKey('SECRETKEY123')).toBe('••••••••KY123'.replace('KY123', 'Y123').padStart(12, '•'))
    expect(maskLicenseKey(null)).toBe('')
    expect(maskLicenseKey('A-VERY-LONG-SECRET')).toBe('•'.repeat(14) + 'CRET')
  })
  it('computes states', () => {
    expect(licenseState({ status: 'active', startsAt: at(-5), expiresAt: at(100) }, now).state).toBe('active')
    expect(licenseState({ status: 'active', startsAt: at(-5) }, now).state).toBe('active')
    const soon = licenseState({ status: 'active', startsAt: at(-5), expiresAt: at(30) }, now)
    expect(soon).toEqual({ state: 'expiring', daysLeft: 30 })
    expect(licenseState({ status: 'active', startsAt: at(-5), expiresAt: at(31) }, now).state).toBe('active')
    expect(licenseState({ status: 'active', startsAt: at(-50), expiresAt: at(-1) }, now).state).toBe('expired')
    expect(licenseState({ status: 'expired', startsAt: at(-50) }, now).state).toBe('expired')
    expect(licenseState({ status: 'revoked', startsAt: at(-5), expiresAt: at(100) }, now).state).toBe('revoked')
    expect(licenseState({ status: 'suspended', startsAt: at(-5) }, now).state).toBe('suspended')
    expect(licenseState({ status: 'active', startsAt: at(2) }, now).state).toBe('upcoming')
    expect(licenseState({ status: 'active', startsAt: 'nope' }, now).state).toBe('upcoming')
    expect(licenseState({ status: 'active', startsAt: at(-5) }, new Date('bad')).state).toBe('expired')
    expect(licenseState({ status: 'active', startsAt: at(-5), expiresAt: now }, now).state).toBe('expired')
  })
})

describe('portal JWT verification (real Payload JWTAuthentication)', () => {
  const secret = 'unit-test-secret-for-portal-only'
  const now = Math.floor(Date.now() / 1000)
  const claims = { id: 7, collection: 'customers', sid: 'session-7', exp: now + 3600 }
  const sign = (data: object, alg = 'HS256', key = secret, authVersion: number | null = JWT_AUTH_VERSION) => {
    const parts = [Buffer.from(JSON.stringify({ alg, typ: 'JWT', ...(authVersion === null ? {} : { authVersion }) })).toString('base64url'), Buffer.from(JSON.stringify(data)).toString('base64url')]
    return `${parts.join('.')}.${createHmac(alg === 'HS512' ? 'sha512' : 'sha256', key).update(parts.join('.')).digest('base64url')}`
  }
  const authenticate = async (token: string, overrides = {}) => {
    const payload = {
      secret, config: { cookiePrefix: 'payload', csrf: [], admin: {}, auth: { jwtOrder: ['JWT', 'cookie'] } },
      collections: { customers: { config: { slug: 'customers', auth: { depth: 0, verify: true, useSessions: true } } } },
      findByID: vi.fn().mockResolvedValue({ id: 7, _verified: true, sessions: [{ id: 'session-7', expiresAt: new Date(Date.now() + 3600000).toISOString() }], ...overrides }),
    }
    const args = { headers: new Headers({ cookie: `sm_customer=${token}` }), payload } as unknown as Parameters<AuthStrategy['authenticate']>[0]
    return portalCookieStrategy.authenticate(args)
  }
  it('accepts only a correctly signed, live customer session', async () => {
    expect((await authenticate(sign(claims))).user).toMatchObject({ id: 7, collection: 'customers', _sid: 'session-7' })
  })
  it('rejects pre-upgrade tokens and an unsupported signed auth version', async () => {
    for (const version of [null, JWT_AUTH_VERSION + 1])
      expect((await authenticate(sign(claims, 'HS256', secret, version))).user).toBeNull()
  })
  it.each([
    { ...claims, collection: 'users' }, { ...claims, exp: now - 1 }, { ...claims, exp: undefined },
    { ...claims, exp: '9999999999' }, { ...claims, sid: undefined }, { ...claims, id: '7' },
  ])('rejects missing/foreign/expired claims: %j', async (data) => {
    expect((await authenticate(sign(data))).user).toBeNull()
  })
  it('rejects tampering, wrong algorithms, unverified accounts and revoked/expired sessions', async () => {
    for (const token of [sign(claims, 'HS256', 'wrong-secret'), sign(claims, 'HS512'), 'aaa.bbb.ccc']) {
      expect((await authenticate(token)).user).toBeNull()
    }
    for (const overrides of [{ _verified: false }, { sessions: [] }, { sessions: [{ id: 'session-7', expiresAt: new Date(0).toISOString() }] }]) {
      expect((await authenticate(sign(claims), overrides)).user).toBeNull()
    }
  })
})

describe('portal request protection', () => {
  it('requires Origin and the exact host/port', () => {
    expect(sameOrigin(new Headers({ host: '127.0.0.1:3100' })).ok).toBe(false)
    expect(sameOrigin(new Headers({ host: '127.0.0.1:3100', origin: 'http://evil.test' })).ok).toBe(false)
    expect(sameOrigin(new Headers({ host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' })).ok).toBe(true)
  })
  it('limits rotating accounts even without a trusted proxy IP', () => {
    const scope = `test-unknown-${Date.now()}`
    for (let i = 0; i < 8; i++) expect(allowAuthAttempt(new Headers({ 'x-forwarded-for': `192.0.2.${i}` }), `user-${i}`, scope, 2)).toBe(true)
    expect(allowAuthAttempt(new Headers(), 'another-account', scope, 2)).toBe(false)
  })
  it('shares account limits across trusted IPs, email whitespace and case', () => {
    vi.stubEnv('FORM_PROXY_SECRET', 's'.repeat(32))
    try {
      const h = (ip: string) => new Headers({ 'x-softmarket-proxy-secret': 's'.repeat(32), 'x-softmarket-client-ip': ip })
      const scope = `test-account-${Date.now()}`
      expect(allowAuthAttempt(h('192.0.2.1'), ' Ada@Example.test ', scope, 1)).toBe(true)
      expect(allowAuthAttempt(h('192.0.2.2'), 'ada@example.test', scope, 1)).toBe(false)
    } finally { vi.unstubAllEnvs() }
  })
})

describe('customer credential and consent hooks', () => {
  const hook = Customers.hooks!.beforeValidate![0]
  const run = (data: Record<string, unknown>, operation = 'update', context = {}) => hook({ data, operation, req: { context } } as never)
  it('revokes all sessions with password changes and native password resets', async () => {
    expect(await run({ password: 'NewPassword1', sessions: [{ id: 'old' }] })).toMatchObject({ sessions: [] })
    expect(await run({ hash: 'new-hash', salt: 'new-salt', sessions: [{ id: 'old' }] })).toMatchObject({ sessions: [] })
    expect(await run({ name: 'Ada', sessions: [{ id: 'keep' }] })).toMatchObject({ sessions: [{ id: 'keep' }] })
    expect(await hook({ data: { name: 'Ada', hash: 'old-hash', salt: 'old-salt', sessions: [{ id: 'keep' }] }, originalDoc: { id: 7 }, operation: 'update', req: { context: {} } } as never)).toMatchObject({ sessions: [{ id: 'keep' }] })
  })
  it('records server-owned consent only for validated portal registration', async () => {
    const result = await run({ kvkkConsentAt: 'fake', kvkkConsentVersion: 'fake' }, 'create', { portalRegistration: true })
    expect(result).toMatchObject({ kvkkConsentVersion: KVKK_CONSENT_VERSION, kvkkConsentAt: expect.any(String) })
    expect(Number.isFinite(Date.parse(result!.kvkkConsentAt))).toBe(true)
    for (const name of ['kvkkConsentAt', 'kvkkConsentVersion']) {
      const field = Customers.fields.find((f) => 'name' in f && f.name === name)
      expect(field && 'access' in field && field.access?.update?.({} as never)).toBe(false)
      expect(field && 'access' in field && field.access?.create?.({} as never)).toBe(false)
    }
  })
  it('blocks direct auth API bypasses but permits server-side auth', async () => {
    const before = Customers.hooks!.beforeOperation![0]
    for (const operation of ['login', 'forgotPassword', 'resetPassword']) {
      expect(() => before({ args: {}, operation, req: { payloadAPI: 'REST' } } as never)).toThrow()
      expect(before({ args: {}, operation, req: { payloadAPI: 'local' } } as never)).toEqual({})
    }
  })
  it('rejects credential/system fields in customer API updates unless the password was verified server-side', () => {
    const before = Customers.hooks!.beforeOperation![0]
    const req = { payloadAPI: 'local', user: { id: 7, collection: 'customers' }, context: {} }
    for (const field of ['email', '_verified', 'password', 'hash', 'salt', 'sessions', 'roles', 'kvkkConsentAt']) {
      expect(() => before({ args: { data: { [field]: 'injected' } }, operation: 'update', req } as never)).toThrow()
    }
    expect(before({ args: { data: { name: 'Ada' } }, operation: 'update', req } as never)).toEqual({ data: { name: 'Ada' } })
    expect(before({ args: { data: { password: 'new-password' } }, operation: 'update', req: { ...req, context: { portalPasswordChange: true } } } as never)).toEqual({ data: { password: 'new-password' } })
  })
  it('requires validated registration context for anonymous create', async () => {
    const create = Customers.access!.create!
    expect(await create({ req: { user: null, context: {} } as PayloadRequest })).toBe(false)
    expect(await create({ req: { user: null, context: { portalRegistration: true } } as unknown as PayloadRequest })).toBe(true)
    expect(await create({ req: { user: { collection: 'customers', id: 7 }, context: { portalRegistration: true } } as unknown as PayloadRequest })).toBe(false)
  })
})

describe('forms', () => {
  it('ticket schema', () => {
    const ok = { subject: 'Kurulum hatası', product: '12', body: 'Detaylı açıklama burada.', locale: 'tr' }
    expect(ticketSchema.safeParse(ok).success).toBe(true)
    expect(ticketSchema.safeParse({ ...ok, product: '1; drop' }).success).toBe(false)
    expect(ticketSchema.safeParse({ ...ok, product: '0' }).success).toBe(false)
    expect(ticketSchema.safeParse({ ...ok, subject: 'abc' }).success).toBe(false)
    expect(ticketSchema.safeParse({ ...ok, body: 'kısa' }).success).toBe(false)
    expect(ticketSchema.safeParse({ ...ok, body: 'x'.repeat(10001) }).success).toBe(false)
    expect(replySchema.safeParse({ ticket: '3', body: 'ok', locale: 'en' }).success).toBe(true)
    expect(replySchema.safeParse({ ticket: 'x', body: 'ok', locale: 'en' }).success).toBe(false)
  })
  it('register requires consent and matching strong-length passwords', () => {
    const ok = { name: 'Ada', email: 'a@b.co', password: 'longpassword1', confirm: 'longpassword1', consent: 'on', locale: 'tr' }
    expect(registerSchema.safeParse(ok).success).toBe(true)
    expect(registerSchema.safeParse({ ...ok, consent: undefined }).success).toBe(false)
    expect(registerSchema.safeParse({ ...ok, confirm: 'different12345' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...ok, password: 'short', confirm: 'short' }).success).toBe(false)
  })
  it('password change must differ from current', () => {
    expect(passwordChangeSchema.safeParse({ current: 'same-password-1', password: 'same-password-1', confirm: 'same-password-1' }).success).toBe(false)
  })
})

describe('portal cookie', () => {
  const jwt = 'aaa.bbb_-.ccc'
  it('reads only its own cookie with a JWT shape', () => {
    expect(readCookie(`payload-token=${jwt}; sm_customer=${jwt}`, 'sm_customer')).toBe(jwt)
    expect(readCookie(`payload-token=${jwt}`, 'sm_customer')).toBeNull()
    expect(readCookie('sm_customer=not-a-jwt', 'sm_customer')).toBeNull()
  })
})
