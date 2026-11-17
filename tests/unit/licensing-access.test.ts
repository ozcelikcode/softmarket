import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { createLicense, setupLicensingDb, type Ctx, type Principal } from './helpers/licensing-db'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * L1 access matrix on a real temporary SQLite (all migrations, real Payload auth through REST/GraphQL handlers):
 *   - the five security collections: read = admin PANEL session only; create/update/delete = nobody (also admin);
 *     anonymous, customer, editor and the admin users API key (MCP/REST) get 401/403. No GraphQL surface.
 *   - licensing-settings global: panel admin read, server-only write.
 *   - licenses: new status metadata is admin-only; publicId server-generated/immutable; the API key cannot set status.
 *   - products.licensing: staff read, panel-admin write, code format/unique/immutable.
 */
let ctx: Ctx
const SECURITY = ['license-activations', 'license-status-log', 'security-events', 'security-blocks', 'security-audit'] as const
const DENIED: Principal[] = ['anonymous', 'customer', 'editor', 'apiKey', 'adminBearer']
const ALL: Principal[] = [...DENIED, 'admin']
const denied = (status: number) => expect([401, 403]).toContain(status)
const ids: Record<(typeof SECURITY)[number], number> = {} as never
let license: { id: number; publicId: string }

const SAMPLE: Record<(typeof SECURITY)[number], (license: number, event: number) => Record<string, unknown>> = {
  'license-activations': (l) => ({ publicId: 'a'.repeat(24), license: l, status: 'active', devicePublicKey: 'pk', deviceKeyThumbprint: 'th', fingerprintHash: 'fp', activatedAt: '2026-11-17T00:00:00.000Z', lastIpPrefix: '203.0.113.0/24', lastIpHash: 'iphash' }),
  'security-events': (l) => ({ type: 'api.replay', severity: 'high', source: 'api', firstSeenAt: '2026-11-17T00:00:00.000Z', lastSeenAt: '2026-11-17T00:00:00.000Z', count: 1, dedupeKey: 'api.replay|x|1', license: l, ipPrefix: '203.0.113.0/24', ipHash: 'eventiphash' }),
  'security-blocks': (_l, e) => ({ kind: 'ip_prefix', value: '198.51.100.0/24', scope: 'api', source: 'admin', event: e }),
  'license-status-log': (l) => ({ license: l, from: 'active', to: 'suspended', source: 'system', at: '2026-11-17T00:00:00.000Z' }),
  'security-audit': (l) => ({ action: 'license.suspend', actorKind: 'admin', target: { relationTo: 'licenses', value: l }, at: '2026-11-17T00:00:00.000Z', result: 'ok', nonce: 'n-1' }),
}

beforeAll(async () => {
  ctx = await setupLicensingDb('l1-access')
  license = await createLicense(ctx)
  ids['security-events'] = (await ctx.payload.create({ collection: 'security-events', overrideAccess: true, data: SAMPLE['security-events'](license.id, 0) as never })).id as number
  for (const slug of SECURITY.filter((s) => s !== 'security-events')) {
    ids[slug] = (await ctx.payload.create({ collection: slug, overrideAccess: true, data: SAMPLE[slug](license.id, ids['security-events']) as never })).id as number
  }
}, 240000)

afterAll(async () => { await ctx?.destroy() })

describe('security collections (REST)', () => {
  it.each(SECURITY)('%s: only an admin panel session reads; nobody writes', async (slug) => {
    for (const who of DENIED) {
      denied((await ctx.rest('GET', slug, who)).status)
      denied((await ctx.rest('GET', `${slug}/${ids[slug]}`, who)).status)
      denied((await ctx.rest('GET', `${slug}/count?where[id][equals]=${ids[slug]}`, who)).status)
    }
    const list = await ctx.rest('GET', slug, 'admin')
    expect(list.status).toBe(200)
    expect((list.json.docs as unknown[]).length).toBeGreaterThan(0)
    expect((await ctx.rest('GET', `${slug}/${ids[slug]}`, 'admin')).status).toBe(200)

    const before = (await ctx.run(`SELECT COUNT(*) AS n FROM ${slug.replace(/-/g, '_')}`)).rows[0]!.n
    for (const who of ALL) {
      denied((await ctx.rest('POST', slug, who, SAMPLE[slug](license.id, ids['security-events']))).status)
      denied((await ctx.rest('PATCH', `${slug}/${ids[slug]}`, who, { createdAt: '2020-01-01T00:00:00.000Z' })).status)
      denied((await ctx.rest('DELETE', `${slug}/${ids[slug]}`, who)).status)
    }
    expect((await ctx.run(`SELECT COUNT(*) AS n FROM ${slug.replace(/-/g, '_')}`)).rows[0]!.n).toBe(before)
  }, 120000)

  it('Local API without overrideAccess follows the same matrix', async () => {
    const users = {
      editor: { ...(await ctx.payload.findByID({ collection: 'users', id: ctx.ids.editor, overrideAccess: true })), collection: 'users' },
      customer: { ...(await ctx.payload.findByID({ collection: 'customers', id: ctx.ids.customer, overrideAccess: true })), collection: 'customers' },
      apiKey: { ...(await ctx.payload.findByID({ collection: 'users', id: ctx.ids.admin, overrideAccess: true })), collection: 'users', _strategy: 'api-key' },
      admin: { ...(await ctx.payload.findByID({ collection: 'users', id: ctx.ids.admin, overrideAccess: true })), collection: 'users', _strategy: 'local-jwt' },
    }
    const { _strategy: _ignored, ...adminWithoutSession } = users.admin
    for (const slug of SECURITY) {
      for (const user of [null, users.editor, users.customer, users.apiKey, adminWithoutSession]) {
        await expect(ctx.payload.find({ collection: slug, overrideAccess: false, user: user as never })).rejects.toThrow()
      }
      expect((await ctx.payload.find({ collection: slug, overrideAccess: false, user: users.admin as never })).totalDocs).toBeGreaterThan(0)
      await expect(ctx.payload.create({ collection: slug, overrideAccess: false, user: users.admin as never, data: SAMPLE[slug](license.id, ids['security-events']) as never })).rejects.toThrow()
      await expect(ctx.payload.delete({ collection: slug, id: ids[slug], overrideAccess: false, user: users.admin as never })).rejects.toThrow()
      await expect(ctx.payload.update({ collection: slug, id: ids[slug], overrideAccess: false, user: users.admin as never, data: {} })).rejects.toThrow()
    }
  })

  it('has no GraphQL surface and is not in the MCP allow-list', async () => {
    const { text } = await ctx.graphql('{ __schema { queryType { fields { name } } mutationType { fields { name } } } }', 'admin')
    const fields = (JSON.parse(text) as { data: { __schema: { queryType: { fields: { name: string }[] }; mutationType: { fields: { name: string }[] } } } }).data.__schema
    const names = [...fields.queryType.fields, ...fields.mutationType.fields].map((f) => f.name)
    expect(names.length).toBeGreaterThan(10)
    expect(names.filter((n) => /security|activation|statuslog|licensingsetting/i.test(n))).toEqual([])
    const { mcpCollections, mcpGlobals } = await import('../../src/lib/mcp')
    for (const slug of SECURITY) expect(mcpCollections).not.toHaveProperty(slug)
    expect(mcpGlobals).not.toHaveProperty('licensing-settings')
  })

  it('sensitive values never reach a denied principal', async () => {
    for (const who of DENIED) {
      for (const slug of SECURITY) expect(JSON.stringify((await ctx.rest('GET', slug, who)).json)).not.toMatch(/203\.0\.113|iphash|eventiphash/)
    }
  })

  it.each(SECURITY)('%s has no versions or document locks for any principal', async (slug) => {
    expect(ctx.payload.collections[slug].config.lockDocuments).toBe(false)
    for (const who of ALL) {
      expect((await ctx.rest('GET', `${slug}/versions`, who)).status).toBeGreaterThanOrEqual(400)
      expect((await ctx.rest('GET', `${slug}/versions/1`, who)).status).toBeGreaterThanOrEqual(400)
      const lock = await ctx.rest('POST', 'payload-locked-documents', who, {
        document: { relationTo: slug, value: ids[slug] },
        user: { relationTo: 'users', value: ctx.ids.admin },
      })
      // Payload may accept an empty lock but cannot attach it to a security document.
      expect(lock.json.doc).not.toMatchObject({ document: { relationTo: slug } })
    }
    expect(ctx.payload.collections['payload-locked-documents'].config.fields).toContainEqual(expect.objectContaining({
      name: 'document', relationTo: expect.not.arrayContaining([slug]),
    }))
  })
})

describe('licensing-settings global', () => {
  it('only a panel admin reads and only server code writes', async () => {
    for (const who of DENIED) {
      denied((await ctx.rest('GET', 'globals/licensing-settings', who)).status)
      denied((await ctx.rest('POST', 'globals/licensing-settings', who, { apiEnabled: true })).status)
    }
    denied((await ctx.rest('POST', 'globals/licensing-settings', 'admin', { apiEnabled: true })).status)
    const { createLocalReq } = await import('payload')
    const { user } = await ctx.payload.auth({ headers: new Headers(ctx.headers.admin) })
    expect(user).not.toBeNull()
    const req = await createLocalReq({ user: user ?? undefined }, ctx.payload)
    await expect(ctx.payload.findGlobal({ slug: 'licensing-settings', overrideAccess: false, req })).resolves.toBeDefined()
    await expect(ctx.payload.updateGlobal({ slug: 'licensing-settings', overrideAccess: false, req, data: { apiEnabled: true } })).rejects.toThrow()
    for (const who of ALL) {
      expect((await ctx.rest('GET', 'globals/licensing-settings/versions', who)).status).toBeGreaterThanOrEqual(400)
    }
    const read = await ctx.rest('GET', 'globals/licensing-settings', 'admin')
    expect(read.status).toBe(200)
    // Safe defaults: API off, every rule notify-only, no automatic suspension window.
    expect(read.json).toMatchObject({ apiEnabled: false, leaseDays: 14, rules: { maxAutoSuspendsPerHour: 5, ipSpread: { mode: 'notify' }, cloneSuspected: { mode: 'notify' } } })
    expect((read.json.rules as Record<string, unknown>).observeUntil ?? null).toBeNull()
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', overrideAccess: true, data: { leaseDays: 20, limits: { globalPerSecond: 150 } } })
    expect((await ctx.payload.findGlobal({ slug: 'licensing-settings', overrideAccess: true })).leaseDays).toBe(20)
    expect((await ctx.run('SELECT api_enabled FROM licensing_settings')).rows[0]).toMatchObject({ api_enabled: 0 })
  })

  it('enforces settings bounds and exposes only server-supplied public signing metadata', async () => {
    for (const body of [{ leaseDays: 31 }, { clockSkewSeconds: 30 }, { retention: { statusLogYears: 9 } }, { retention: { eventIpDays: 1 } },
      { rules: { ipSpread: { mode: 'revoke' } } }, { publicHost: 'https://evil.example/x' }]) {
      await expect(ctx.payload.updateGlobal({ slug: 'licensing-settings', overrideAccess: true, data: body as never })).rejects.toMatchObject({ status: 400 })
    }
    const createdAt = '2026-01-01T00:00:00.000Z'
    const privateKey = 'test-private-key-material'
    const signingKeys = [{ kid: 'key-1', publicKey: 'public-key', createdAt, privateKey }]
    denied((await ctx.rest('POST', 'globals/licensing-settings', 'admin', { signingKeys, privateKey })).status)
    await ctx.payload.updateGlobal({ slug: 'licensing-settings', overrideAccess: true, data: { signingKeys, privateKey } as never })
    const { json } = await ctx.rest('GET', 'globals/licensing-settings?select[signingKeys]=true&select[privateKey]=true', 'admin')
    expect(json).toMatchObject({ signingKeys: [{ kid: 'key-1', publicKey: 'public-key', createdAt }] })
    expect(JSON.stringify(json)).not.toContain(privateKey)
  })
})

describe('licenses (new fields)', () => {
  it('status metadata is admin-only; the owner reads publicId but not the reason/source', async () => {
    await ctx.payload.update({ collection: 'licenses', id: license.id, overrideAccess: true, data: { status: 'suspended' }, context: { licenseTransition: { source: 'payment', reason: 'payment_dispute' } } })
    const own = await ctx.rest('GET', `licenses/${license.id}`, 'customer')
    expect(own.status).toBe(200)
    expect(own.json.publicId).toBe(license.publicId)
    for (const key of ['statusReason', 'statusSource', 'statusChangedAt']) expect(own.json).not.toHaveProperty(key)
    const staff = await ctx.rest('GET', `licenses/${license.id}`, 'admin')
    expect(staff.json).toMatchObject({ statusReason: 'payment_dispute', statusSource: 'payment' })
    expect((await ctx.rest('GET', `licenses/${license.id}?depth=4&select[statusReason]=true&select[product]=true`, 'customer')).json).not.toHaveProperty('statusReason')
    for (const field of ['statusReason', 'statusSource', 'statusChangedAt', 'product.licensing.code']) {
      expect((await ctx.rest('GET', `licenses?where[or][0][${field}][exists]=true`, 'customer')).status, field).toBe(400)
      expect((await ctx.rest('GET', `licenses/count?where[${field}][exists]=true`, 'customer')).status, field).toBe(400)
      expect((await ctx.rest('GET', `licenses?sort=-${field}`, 'customer')).status, field).toBe(400)
    }
    const ownGraphql = await ctx.graphql(`{ License(id: ${license.id}) { statusReason statusSource statusChangedAt } }`, 'customer')
    expect(JSON.parse(ownGraphql.text)).toMatchObject({ data: { License: { statusReason: null, statusSource: null, statusChangedAt: null } } })
    const filteredGraphql = await ctx.graphql('{ Licenses(where: { statusReason: { exists: true } }) { totalDocs } }', 'customer')
    expect(JSON.parse(filteredGraphql.text)).toHaveProperty('errors')
    const full = await ctx.rest('GET', `licenses/${license.id}?depth=4`, 'customer')
    expect(full.status).toBe(200)
    expect(JSON.stringify(full.json)).not.toMatch(/fingerprintHash|203\.0\.113|iphash|"licensing"/)
    denied((await ctx.rest('GET', `licenses/${license.id}`, 'anonymous')).status)
    await ctx.payload.update({ collection: 'licenses', id: license.id, overrideAccess: true, data: { status: 'active' } as never })
  })

  it('publicId is generated on create, ignores client input and never changes', async () => {
    const created = await ctx.rest('POST', 'licenses', 'apiKey', { customer: ctx.ids.otherCustomer, edition: ctx.ids.edition, publicId: 'f'.repeat(24), status: 'revoked', statusReason: 'manual' })
    expect(created.status).toBe(201)
    const doc = created.json.doc as Record<string, unknown>
    expect(doc.publicId).toMatch(/^[0-9a-f]{24}$/)
    expect(doc.publicId).not.toBe('f'.repeat(24))
    // The API key cannot choose the initial status either: it gets the default.
    expect(doc.status).toBe('active')
    expect(doc.statusReason ?? null).toBeNull()
    for (const who of ['apiKey', 'admin'] as const) {
      expect((await ctx.rest('PATCH', `licenses/${doc.id}`, who, { publicId: 'e'.repeat(24), statusSource: 'payment' })).status).toBe(200)
    }
    const row = (await ctx.run(`SELECT public_id, status_source FROM licenses WHERE id = ${Number(doc.id)}`)).rows[0]
    expect(row).toMatchObject({ public_id: doc.publicId, status_source: null })
  })

  it('maxDevices accepts >= 1 only; customers and editors still cannot write licenses', async () => {
    for (const maxDevices of [0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect((await ctx.rest('PATCH', `licenses/${license.id}`, 'admin', { maxDevices })).status).toBe(400)
    }
    expect((await ctx.rest('PATCH', `licenses/${license.id}`, 'admin', { maxDevices: 4 })).status).toBe(200)
    for (const who of ['customer', 'editor', 'anonymous'] as const) denied((await ctx.rest('PATCH', `licenses/${license.id}`, who, { maxDevices: 9 })).status)
    expect((await ctx.run(`SELECT max_devices FROM licenses WHERE id = ${license.id}`)).rows[0]).toMatchObject({ max_devices: 4 })
  })
})

describe('products.licensing', () => {
  const productRow = async (id = ctx.ids.product) => (await ctx.run(`SELECT licensing_enabled AS enabled, licensing_code AS code FROM products WHERE id = ${id}`)).rows[0]

  it('is hidden from public reads and writable only by a panel admin', async () => {
    const pub = await ctx.rest('GET', `products/${ctx.ids.product}`, 'anonymous')
    expect(pub.status).toBe(200)
    expect(pub.json).not.toHaveProperty('licensing')
    const cust = await ctx.rest('GET', `products/${ctx.ids.product}`, 'customer')
    expect(cust.json).not.toHaveProperty('licensing')
    for (const who of ['editor', 'apiKey', 'adminBearer'] as const) {
      expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, who, { licensing: { enabled: false, code: 'sneaky-code' } })).status).toBe(200)
    }
    expect(await productRow()).toMatchObject({ code: null })
    expect(JSON.stringify((await ctx.graphql(`{ Products { docs { id } } }`, 'anonymous')).text)).not.toContain('licensing')
  })

  it('enforces format and the enable prerequisite even in autosaves', async () => {
    const path = `products/${ctx.ids.product}?draft=true&autosave=true`
    expect((await ctx.rest('PATCH', path, 'admin', { licensing: { code: 'BAD!' } })).status).toBe(400)
    expect((await ctx.rest('PATCH', path, 'admin', { licensing: { enabled: true } })).status).toBe(400)
  })

  it('hides licensing data from public predicates, ordering, GraphQL and search population', async () => {
    for (const who of ['anonymous', 'customer'] as const) {
      for (const resource of ['products', 'products/count']) {
        expect((await ctx.rest('GET', `${resource}?where[licensing.code][exists]=true`, who)).status).toBe(400)
      }
      expect((await ctx.rest('GET', 'products?sort=licensing.enabled', who)).status).toBe(400)
      const result = await ctx.graphql('{ Products { docs { id licensing { code enabled } } } }', who)
      expect(JSON.parse(result.text)).toMatchObject({ data: { Products: { docs: [{ id: ctx.ids.product, licensing: { code: null, enabled: null } }] } } })
      const search = await ctx.rest('GET', 'search?depth=4', who)
      expect(search.status).toBe(200)
      expect(search.json.docs).toEqual(expect.arrayContaining([expect.objectContaining({ doc: expect.objectContaining({ relationTo: 'products' }) })]))
      expect(JSON.stringify(search.json)).not.toMatch(/"licensing"|fingerprintHash|iphash/)
    }
  })

  it('validates, then locks the code once set (unique, immutable, not clearable)', async () => {
    expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: { enabled: true } })).status).toBe(400)
    for (const code of ['Studio', 'ab', '-studio', 'studio_pro', 'a'.repeat(42)]) {
      expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: { code } })).status, code).toBe(400)
    }
    expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: { enabled: true, code: 'studio-pro' } })).status).toBe(200)
    expect(await productRow()).toMatchObject({ enabled: 1, code: 'studio-pro' })
    const enabledVersion = (await ctx.payload.findVersions({
      collection: 'products', where: { parent: { equals: ctx.ids.product }, 'version.licensing.enabled': { equals: true } }, limit: 1,
    })).docs[0]!
    expect((await ctx.rest('GET', `products/${ctx.ids.product}`, 'editor')).json).toMatchObject({ licensing: { enabled: true, code: 'studio-pro' } })
    for (const code of ['studio-pro-2', '', null]) {
      expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: { code } })).status, String(code)).toBe(400)
    }
    expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: null })).status).toBe(400)
    // Draft/autosave writes are checked too.
    expect((await ctx.rest('PATCH', `products/${ctx.ids.product}?draft=true&autosave=true`, 'admin', { licensing: { code: 'other-code' } })).status).toBe(400)
    // Server code (Local API, overrideAccess) cannot change it either.
    await expect(ctx.payload.update({ collection: 'products', id: ctx.ids.product, overrideAccess: true, data: { licensing: { code: 'local-change' } } as never })).rejects.toThrow()
    expect(await productRow()).toMatchObject({ code: 'studio-pro' })
    // Turning the API off for the product keeps the code.
    expect((await ctx.rest('PATCH', `products/${ctx.ids.product}`, 'admin', { licensing: { enabled: false, code: 'studio-pro' } })).status).toBe(200)
    for (const who of ['editor', 'apiKey', 'adminBearer'] as const) {
      await ctx.rest('POST', `products/versions/${enabledVersion.id}`, who)
      expect(await productRow()).toMatchObject({ enabled: 0, code: 'studio-pro' })
    }

    const other = (await ctx.payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'Ürün 2', slug: 'urun-l1-2', family: ctx.ids.family, _status: 'published' } as never })).id as number
    expect((await ctx.rest('PATCH', `products/${other}`, 'admin', { licensing: { code: 'studio-pro' } })).status).toBe(400)
    // Several products without a code coexist (empty input is stored as NULL).
    expect((await ctx.rest('PATCH', `products/${other}`, 'admin', { licensing: { code: '' } })).status).toBe(200)
    expect(await productRow(other)).toMatchObject({ code: null })
  })

  it('rejects reusing a draft code on another product', async () => {
    const makeProduct = (name: string) => ctx.payload.create({ collection: 'products', locale: 'tr', data: {
      title: name, slug: name, family: ctx.ids.family, _status: 'published',
    } })
    const first = await makeProduct('l1-draft-first')
    const second = await makeProduct('l1-draft-second')
    const code = 'l1-draft-code'
    expect((await ctx.rest('PATCH', `products/${first.id}?draft=true&autosave=true`, 'admin', { licensing: { code } })).status).toBe(200)
    expect((await ctx.rest('PATCH', `products/${second.id}?draft=true&autosave=true`, 'admin', { licensing: { code } })).status).toBe(400)
    expect((await ctx.rest('PATCH', `products/${second.id}`, 'admin', { licensing: { code } })).status).toBe(400)
    const oldest = (await ctx.payload.findVersions({ collection: 'products', where: { parent: { equals: first.id } }, sort: 'id', limit: 1 })).docs[0]!
    for (const who of ['admin', 'editor', 'apiKey'] as const) {
      await ctx.rest('POST', `products/versions/${oldest.id}`, who)
      expect((await ctx.payload.findByID({ collection: 'products', id: first.id, draft: true })).licensing?.code).toBe(code)
    }
  })

  it('keeps codes immutable when a product was created with a projected response', async () => {
    const created = await ctx.payload.create({
      collection: 'products',
      locale: 'tr',
      select: { title: true },
      data: {
        title: 'Projected product', slug: 'l1-projected-product', family: ctx.ids.family, _status: 'published',
        licensing: { code: 'l1-projected-code', enabled: true },
      },
    })
    expect(await productRow(created.id)).toMatchObject({ code: 'l1-projected-code', enabled: 1 })
    expect((await ctx.rest('PATCH', `products/${created.id}`, 'admin', { licensing: { code: 'replacement-code' } })).status).toBe(400)
    expect(await productRow(created.id)).toMatchObject({ code: 'l1-projected-code', enabled: 1 })
  })
})

describe('partial unique indexes on a fully migrated database', () => {
  it('exist after the complete migration chain (guards against silent loss in a later rebuild)', async () => {
    const rows = (await ctx.run(`PRAGMA index_list('license_activations')`)).rows
    expect(rows.filter((r) => Number(r.partial) === 1).map((r) => r.name).sort()).toEqual(['license_activations_one_active_fp', 'license_activations_one_active_thumb'])
    const dup = { ...SAMPLE['license-activations'](license.id, 0), publicId: 'b'.repeat(24), deviceKeyThumbprint: 'th-2' }
    await expect(ctx.payload.create({ collection: 'license-activations', overrideAccess: true, data: dup as never })).rejects.toThrow()
    await ctx.payload.create({ collection: 'license-activations', overrideAccess: true, data: { ...dup, status: 'deactivated' } as never })
  })
})
