import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload, TypedUser } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/*
 * P2-S on real (temporary) SQLite:
 *  - migration `p2_payments_commerce`: up() only CREATE TABLE/INDEX + ADD COLUMN; safe down() refuses while sales
 *    data exists and otherwise removes exactly what up() added (old rows and table definitions unchanged);
 *  - access matrix for orders / payment-events (anonymous, customer, other customer, editor, admin, admin API key);
 *  - commerce fields: editor/API-key cannot write them, public reads never contain them, payments mode validation;
 *  - store: one licence per order under replays, concurrency and failed conditional writes (full rollback).
 */
const NAME = '20261116_141401_p2_payments_commerce'
let payload: Payload
let dir: string
const run = (q: string) => payload.db.drizzle.$client.execute(q)
type Migration = { name: string; up: (a: never) => Promise<void>; down: (a: never) => Promise<void> }
type MigrateArgs = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']
let migration: Migration
const args = () => ({ db: payload.db.drizzle, payload, req: {} }) as never
const savedEnv = { ...process.env }

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'softmarket-p2s-'))
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  delete process.env.PAYMENTS_ENABLED
  delete process.env.PAYMENTS_STRIPE_ENABLED
  delete process.env.SMTP_HOST
  const { getPayload } = await import('payload')
  payload = await getPayload({ config: (await import('../../src/payload.config')).default })
  expect(realpathSync(String((await run('PRAGMA database_list')).rows.find((r) => r.name === 'main')?.file)))
    .toBe(realpathSync(join(dir, 'test.db')))
  const { migrations } = (await import('../../src/migrations')) as unknown as { migrations: Migration[] }
  const index = migrations.findIndex((m) => m.name === NAME)
  expect(index).toBe(migrations.length - 1)
  migration = migrations[index]
  await payload.db.migrate({ migrations: migrations.slice(0, index) as unknown as MigrateArgs })
  // Pre-P2-S rows, including a document lock (the table up() adds columns to).
  for (const q of [
    `INSERT INTO product_families(id) VALUES(1)`,
    `INSERT INTO product_families_locales(title,slug,_locale,_parent_id) VALUES('Aile','aile','tr',1)`,
    `INSERT INTO products(id,family_id,_status) VALUES(1,1,'published')`,
    `INSERT INTO products_locales(title,slug,_locale,_parent_id) VALUES('Ürün','urun','tr',1)`,
    `INSERT INTO editions(id,sku,product_id,license_type,seats) VALUES(1,'OLD-PRO',1,'subscription',5)`,
    `UPDATE editions SET duration_months = 12 WHERE id = 1`,
    `INSERT INTO editions_locales(title,_locale,_parent_id) VALUES('Pro','tr',1)`,
    `INSERT INTO site_settings(id) VALUES(1)`,
    `INSERT INTO payload_locked_documents(id,global_slug) VALUES(1,NULL)`,
    `INSERT INTO payload_locked_documents_rels("order",parent_id,path,editions_id) VALUES(1,1,'document',1)`,
  ]) await run(q)
}, 240000)
afterAll(async () => {
  await payload?.destroy()
  if (dir) rmSync(dir, { recursive: true, force: true })
  process.env = savedEnv
})

describe(`migration ${NAME}`, () => {
  it('up() only creates tables/indexes and adds columns; down() never rebuilds or deletes', () => {
    const source = readFileSync(join(process.cwd(), 'src/migrations', `${NAME}.ts`), 'utf8')
    const [up, down] = source.split('export async function down')
    expect(up).not.toMatch(/DROP |DELETE FROM|__new_|RENAME|PRAGMA|INSERT INTO|UPDATE `/)
    const statements = [...up.matchAll(/sql`(\w+ \w+)/g)].map((m) => m[1])
    expect(new Set(statements)).toEqual(new Set(['CREATE TABLE', 'CREATE INDEX', 'CREATE UNIQUE', 'ALTER TABLE']))
    expect([...up.matchAll(/CREATE TABLE \\`(\w+)\\`/g)].map((m) => m[1]).sort()).toEqual(['orders', 'orders_items', 'payment_events'])
    const added = [...up.matchAll(/ALTER TABLE \\`(\w+)\\` ADD \\`(\w+)\\`/g)].map((m) => `${m[1]}.${m[2]}`)
    expect(added).toHaveLength(20)
    for (const column of added) expect(column).toMatch(/^(editions\.(sale_mode|pricing_\w+)|site_settings\.commerce_\w+|payload_locked_documents_rels\.(orders|payment_events)_id)$/)
    // Existing values/defaults are untouched; the new defaults are the fail-closed ones.
    expect(up).toContain("ADD \\`sale_mode\\` text DEFAULT 'quote'")
    expect(up).toContain("ADD \\`commerce_mode\\` text DEFAULT 'quote-only'")
    expect(down).not.toMatch(/__new_|INSERT INTO|RENAME|DELETE FROM|PRAGMA foreign_keys/)
    expect(down).toMatch(/down refused/)
  })

  it('up/down keep every pre-existing row and table definition; down refuses while sales data exists', async () => {
    const tables = (await run("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map((r) => String(r.name))
    const snapshot = async () => ({
      rows: await Promise.all(tables.map(async (t) => (await run(`SELECT * FROM "${t}" ORDER BY rowid`)).rows)),
      schema: (await run("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")).rows,
    })
    const before = await snapshot()
    await migration.up(args())
    expect((await run('SELECT sale_mode, pricing_tax_mode, pricing_try_minor FROM editions')).rows[0])
      .toMatchObject({ sale_mode: 'quote', pricing_tax_mode: 'inclusive', pricing_try_minor: null })
    expect((await run('SELECT commerce_mode, commerce_providers_iyzico_enabled, commerce_providers_stripe_enabled, commerce_vat_try_rule FROM site_settings')).rows[0])
      .toMatchObject({ commerce_mode: 'quote-only', commerce_providers_iyzico_enabled: 0, commerce_providers_stripe_enabled: 0, commerce_vat_try_rule: null })

    await run(`INSERT INTO payment_events(id,provider,event_id,event_key,type,body_sha256,received_at) VALUES(1,'iyzico','e','iyzico:e','t','${'a'.repeat(64)}','2026-11-16')`)
    await expect(payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))).rejects.toThrow(/down refused/)
    expect((await run('SELECT COUNT(*) AS n FROM payment_events')).rows[0].n).toBe(1)
    await run('DELETE FROM payment_events')
    await run('UPDATE editions SET pricing_try_minor = 100 WHERE id = 1')
    await expect(payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))).rejects.toThrow(/commerce configuration/)
    await run('UPDATE editions SET pricing_try_minor = NULL WHERE id = 1')

    await payload.db.drizzle.transaction(async (db) => migration.down({ db, payload, req: {} } as never))
    expect(await snapshot()).toEqual(before)
    expect((await run('PRAGMA foreign_key_check')).rows).toEqual([])
    expect((await run('PRAGMA integrity_check')).rows[0]).toMatchObject({ integrity_check: 'ok' })
    await migration.up(args())
  }, 240000)
})

// ---------------------------------------------------------------------------------------------------------------

const password = 'p2s-test-password-123'
let admin: TypedUser
let apiKeyAdmin: TypedUser
let editor: TypedUser
let alice: TypedUser
let bob: TypedUser
let editionId: number
const asUser = <T extends { id: number | string }>(doc: T, collection: 'users' | 'customers', extra: Record<string, unknown> = {}) =>
  ({ ...doc, collection, ...extra }) as unknown as TypedUser

const orderData = (customer: number, status: string, extra: Record<string, unknown> = {}) => ({
  customer,
  status,
  items: [{ edition: editionId, sku: 'P2S-PRO', title: 'Pro', licenseType: 'subscription', durationMonths: 12, seats: 3, taxMode: 'inclusive', unitNetMinor: 1000_00, vatRateBasisPoints: 2000, vatMinor: 200_00, lineTotalMinor: 1200_00 }],
  currency: 'TRY',
  subtotalMinor: 1000_00,
  vatMinor: 200_00,
  totalMinor: 1200_00,
  provider: 'iyzico',
  providerEnv: 'sandbox',
  idempotencyKey: `idem-${Math.random().toString(36).slice(2)}-${Date.now()}`,
  paidAt: status === 'pending' ? undefined : '2026-11-16T10:00:00.000Z',
  billing: { type: 'individual', name: 'Ali Veli', identityNumber: '10000000146', email: 'ali@example.test', city: 'İstanbul' },
  consents: { preInformationVersion: 'v1', distanceSalesVersion: 'v1', digitalWaiverAccepted: true, acceptedAt: '2026-11-16T09:59:00.000Z', ip: '203.0.113.9' },
  notes: 'internal',
  ...extra,
})
const createOrder = async (customer: number, status = 'paid', extra: Record<string, unknown> = {}) =>
  payload.create({ collection: 'orders', overrideAccess: true, depth: 0, data: orderData(customer, status, extra) as never })
/** Payload ValidationError keeps field messages in `data.errors`. */
const rejectsWith = async (promise: Promise<unknown>, pattern: RegExp) => {
  const error = await promise.then(() => null, (e: unknown) => e)
  expect(error, 'expected a rejection').toBeTruthy()
  expect(JSON.stringify((error as { data?: unknown }).data ?? String(error))).toMatch(pattern)
}
const licensesOf = async (customer: number) =>
  (await payload.find({ collection: 'licenses', where: { customer: { equals: customer } }, overrideAccess: true, depth: 0, limit: 100 })).docs

describe('P2-S through Payload', () => {
  beforeAll(async () => {
    const u = async (email: string, roles: string[]) => payload.create({ collection: 'users', overrideAccess: true, data: { email, password, roles } as never })
    const a = await u('admin@p2s.test', ['admin'])
    admin = asUser(a, 'users')
    apiKeyAdmin = asUser(a, 'users', { _strategy: 'api-key' })
    editor = asUser(await u('editor@p2s.test', ['editor']), 'users')
    const c = async (email: string) => payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email, password, name: email, _verified: true } as never })
    alice = asUser(await c('alice@p2s.test'), 'customers')
    bob = asUser(await c('bob@p2s.test'), 'customers')
    editionId = (await payload.create({ collection: 'editions', overrideAccess: true, data: { title: 'Pro', sku: 'P2S-PRO', product: 1, licenseType: 'subscription', durationMonths: 12, seats: 3 } as never })).id as number
  }, 60000)

  describe('orders access matrix', () => {
    let aliceOrder: number
    let bobOrder: number
    beforeAll(async () => {
      aliceOrder = (await createOrder(Number(alice.id), 'fulfilled')).id as number
      bobOrder = (await createOrder(Number(bob.id), 'paid')).id as number
    })
    const read = async (user: TypedUser | null) => {
      try {
        return (await payload.find({ collection: 'orders', user, overrideAccess: false, depth: 0, limit: 100, where: { id: { in: [aliceOrder, bobOrder] } } })).docs
      } catch {
        return 'forbidden' as const
      }
    }

    it('read: anonymous none, customer only own (S3: independent of commerce mode), staff all', async () => {
      expect(await read(null)).toBe('forbidden')
      expect((await read(alice)) as unknown[]).toHaveLength(1)
      expect(((await read(alice)) as { id: number }[])[0].id).toBe(aliceOrder)
      expect(((await read(bob)) as { id: number }[]).map((d) => d.id)).toEqual([bobOrder])
      await expect(payload.findByID({ collection: 'orders', id: bobOrder, user: alice, overrideAccess: false })).rejects.toThrow()
      expect((await read(editor)) as unknown[]).toHaveLength(2)
      expect((await read(admin)) as unknown[]).toHaveLength(2)
    })

    it('field read: editor never sees billing/consents/idempotency; customer never sees notes/key', async () => {
      const [ed] = (await payload.find({ collection: 'orders', user: editor, overrideAccess: false, where: { id: { equals: aliceOrder } } })).docs as unknown as Record<string, unknown>[]
      expect(ed).not.toHaveProperty('billing')
      expect(ed).not.toHaveProperty('consents')
      expect(ed).not.toHaveProperty('invoice')
      expect(ed.notes).toBe('internal')
      expect(ed.idempotencyKey).toBeTruthy()
      const [own] = (await payload.find({ collection: 'orders', user: alice, overrideAccess: false })).docs as unknown as Record<string, unknown>[]
      expect(own.billing).toMatchObject({ identityNumber: '10000000146' })
      expect(own).not.toHaveProperty('notes')
      expect(own).not.toHaveProperty('idempotencyKey')
      expect(own).not.toHaveProperty('requiresReview')
      const [ad] = (await payload.find({ collection: 'orders', user: admin, overrideAccess: false, where: { id: { equals: aliceOrder } } })).docs as unknown as Record<string, unknown>[]
      expect(ad.billing).toMatchObject({ type: 'individual' })
    })

    it('create: nobody through the API (anonymous, customer, editor, admin, admin API key)', async () => {
      for (const user of [null, alice, editor, admin, apiKeyAdmin]) {
        await expect(payload.create({ collection: 'orders', user, overrideAccess: false, data: orderData(Number(alice.id), 'paid') as never })).rejects.toThrow()
      }
    })

    it('update: only admin, and only invoice/notes/requiresReview', async () => {
      for (const user of [null, alice, bob, editor]) {
        await expect(payload.update({ collection: 'orders', id: aliceOrder, user, overrideAccess: false, data: { notes: 'x' } as never })).rejects.toThrow()
      }
      const updated = await payload.update({
        collection: 'orders', id: aliceOrder, user: admin, overrideAccess: false, depth: 0,
        data: { status: 'refunded', totalMinor: 1, customer: Number(bob.id), invoice: { number: 'GIB2026000001' }, notes: 'checked', requiresReview: true } as never,
      })
      const stored = await payload.findByID({ collection: 'orders', id: aliceOrder, overrideAccess: true, depth: 0 })
      expect(stored).toMatchObject({ status: 'fulfilled', totalMinor: 1200_00, customer: Number(alice.id), invoice: { number: 'GIB2026000001' }, notes: 'checked', requiresReview: true })
      expect(updated.status).toBe('fulfilled')
    })

    it('delete: nobody (not even admin)', async () => {
      for (const user of [null, alice, editor, admin]) {
        await expect(payload.delete({ collection: 'orders', id: aliceOrder, user, overrideAccess: false })).rejects.toThrow()
      }
      expect(await payload.findByID({ collection: 'orders', id: aliceOrder, overrideAccess: true })).toBeTruthy()
    })

    it('server create enforces order number, amount invariant, unique idempotency key and buyer identity', async () => {
      const order = await createOrder(Number(alice.id), 'pending', { idempotencyKey: 'idem-unique-key-0001' })
      expect(order.orderNumber).toMatch(/^SM-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/)
      await expect(createOrder(Number(alice.id), 'pending', { idempotencyKey: 'idem-unique-key-0001' })).rejects.toThrow()
      await expect(createOrder(Number(alice.id), 'pending', { totalMinor: 1199_99 })).rejects.toThrow()
      await expect(createOrder(Number(alice.id), 'pending', { items: [{ ...orderData(0, 'paid').items[0], unitNetMinor: 1100_00, vatMinor: 100_00 }] })).rejects.toThrow()
      await expect(createOrder(Number(alice.id), 'pending', { billing: { type: 'individual', name: 'A', identityNumber: '10000000145', email: 'a@b.test' } })).rejects.toThrow()
      await expect(createOrder(Number(alice.id), 'pending', { billing: { type: 'corporate', name: 'A', taxNumber: '1234567890', email: 'a@b.test' } })).rejects.toThrow()
      const corporate = await createOrder(Number(alice.id), 'pending', { billing: { type: 'corporate', name: 'A', company: 'Örnek AŞ', taxNumber: '1234567890', taxOffice: 'Kadıköy', email: 'a@b.test' } })
      expect(corporate.billing).toMatchObject({ type: 'corporate', taxNumber: '1234567890' })
      await expect(createOrder(Number(alice.id), 'pending', { provider: 'iyzico', providerRef: 'tok-1' })).resolves.toBeTruthy()
      await expect(createOrder(Number(bob.id), 'pending', { provider: 'iyzico', providerRef: 'tok-1' })).rejects.toThrow()
    })
  })

  describe('payment-events access', () => {
    it('admin reads; nobody creates, updates or deletes through the API', async () => {
      const store = (await import('../../src/lib/payments/store')).createPaymentEventStore(payload)
      expect(await store.record({ key: 'stripe:evt_access', provider: 'stripe', type: 't', bodySha256: 'b'.repeat(64), receivedAt: new Date() })).toBe(true)
      const [doc] = (await payload.find({ collection: 'payment-events', user: admin, overrideAccess: false, where: { eventKey: { equals: 'stripe:evt_access' } } })).docs
      expect(doc).toMatchObject({ eventId: 'evt_access', signatureVerified: true, status: 'received' })
      for (const user of [null, alice, bob, editor]) {
        await expect(payload.find({ collection: 'payment-events', user, overrideAccess: false })).rejects.toThrow()
      }
      for (const user of [null, alice, editor, admin]) {
        await expect(payload.create({ collection: 'payment-events', user, overrideAccess: false, data: { provider: 'stripe', eventId: 'x', eventKey: 'stripe:x', type: 't', bodySha256: 'c'.repeat(64), receivedAt: new Date().toISOString() } as never })).rejects.toThrow()
        await expect(payload.update({ collection: 'payment-events', id: doc.id, user, overrideAccess: false, data: { status: 'processed' } as never })).rejects.toThrow()
        await expect(payload.delete({ collection: 'payment-events', id: doc.id, user, overrideAccess: false })).rejects.toThrow()
      }
    })
  })

  describe('commerce fields (editions + site-settings)', () => {
    it('editor cannot set price or sale mode; admin can; public reads never contain them', async () => {
      await payload.update({ collection: 'editions', id: editionId, user: editor, overrideAccess: false, data: { saleMode: 'buy', pricing: { tryMinor: 5 } } as never })
      let stored = await payload.findByID({ collection: 'editions', id: editionId, overrideAccess: true, depth: 0 })
      expect(stored).toMatchObject({ saleMode: 'quote', pricing: { tryMinor: null } })
      await expect(payload.update({ collection: 'editions', id: editionId, user: admin, overrideAccess: false, data: { saleMode: 'buy' } as never })).rejects.toThrow()
      await payload.update({ collection: 'editions', id: editionId, user: apiKeyAdmin, overrideAccess: false, data: { saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 1200_00 } } as never })
      stored = await payload.findByID({ collection: 'editions', id: editionId, overrideAccess: true, depth: 0 })
      expect(stored).toMatchObject({ saleMode: 'buy', pricing: { taxMode: 'inclusive', tryMinor: 1200_00 } })
      await expect(payload.update({ collection: 'editions', id: editionId, user: admin, overrideAccess: false, data: { pricing: { usdMinor: 12.5 } } as never })).rejects.toThrow()
      for (const user of [null, alice]) {
        const doc = await payload.findByID({ collection: 'editions', id: editionId, user, overrideAccess: false, depth: 0 })
        expect(doc).not.toHaveProperty('saleMode')
        expect(doc).not.toHaveProperty('pricing')
      }
      expect(await payload.findByID({ collection: 'editions', id: editionId, user: editor, overrideAccess: false, depth: 0 })).toHaveProperty('pricing')
      await payload.update({ collection: 'editions', id: editionId, overrideAccess: true, data: { saleMode: 'quote' } as never })
    })

    it('site-settings: hidden from public, API key cannot switch, payments needs capability + provider + VAT, quoteSince on switch back', async () => {
      const commerceOf = async (user: TypedUser | null) => ((await payload.findGlobal({ slug: 'site-settings', user, overrideAccess: false, depth: 0 })) as { commerce?: Record<string, unknown> }).commerce ?? {}
      expect(Object.keys(await commerceOf(null))).not.toContain('mode')
      expect(Object.keys(await commerceOf(alice))).not.toContain('vat')
      expect(await commerceOf(editor)).toMatchObject({ mode: 'quote-only', providers: { iyzico: { enabled: false }, stripe: { enabled: false } } })

      const ready = { mode: 'payments', providers: { iyzico: { enabled: true } }, vat: { try: { rule: 'rate', ratePercent: 20 } } }
      await payload.updateGlobal({ slug: 'site-settings', user: apiKeyAdmin, overrideAccess: false, data: { commerce: ready } as never })
      expect(await commerceOf(admin)).toMatchObject({ mode: 'quote-only', providers: { iyzico: { enabled: false } } })
      await expect(payload.updateGlobal({ slug: 'site-settings', user: editor, overrideAccess: false, data: { commerce: ready } as never })).rejects.toThrow()

      await rejectsWith(payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { commerce: ready } as never }), /PAYMENTS_ENABLED/)
      process.env.PAYMENTS_ENABLED = 'true'
      try {
        await rejectsWith(payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { commerce: { ...ready, vat: { try: { rule: null } } } } as never }), /VAT/)
        await rejectsWith(payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { commerce: { ...ready, providers: { stripe: { enabled: true } } } } as never }), /PAYMENTS_STRIPE_ENABLED/)
        await payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { commerce: ready } as never })
        const on = await commerceOf(admin)
        expect(on).toMatchObject({ mode: 'payments', vat: { try: { rule: 'rate', ratePercent: 20, rateBasisPoints: 2000 } }, quoteSince: null })
        const { readVatSettings } = await import('../../src/lib/payments/settings')
        expect(readVatSettings({ commerce: on })).toEqual({ TRY: { kind: 'rate', rateBasisPoints: 2000 } })
      } finally {
        delete process.env.PAYMENTS_ENABLED
      }
      const t0 = Date.now()
      await payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { commerce: { mode: 'quote-only', quoteSince: '2000-01-01T00:00:00.000Z' } } as never })
      const off = await commerceOf(admin)
      expect(off.mode).toBe('quote-only')
      expect(new Date(String(off.quoteSince)).getTime()).toBeGreaterThanOrEqual(t0 - 1000)
      // Unrelated saves keep the drain start; input never sets it.
      await payload.updateGlobal({ slug: 'site-settings', user: admin, overrideAccess: false, data: { tagline: 'x', commerce: { quoteSince: '2000-01-01T00:00:00.000Z' } } as never })
      expect((await commerceOf(admin)).quoteSince).toBe(off.quoteSince)
    })
  })

  describe('store: FulfillmentStore / PaymentEventStore', () => {
    const store = () => import('../../src/lib/payments/store')
    let carol: TypedUser
    beforeAll(async () => {
      carol = asUser(await payload.create({ collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { email: 'carol@p2s.test', password, name: 'Carol', _verified: true } as never }), 'customers')
    })

    it('fulfils a paid order exactly once: licence from generate.ts + hooks, item link, paid → fulfilled', async () => {
      const { fulfillOrder } = await store()
      const order = await createOrder(Number(carol.id), 'paid')
      const effects: unknown[] = []
      const result = await fulfillOrder(payload, order.id, { afterCommit: (r) => void effects.push(r) })
      expect(result.kind).toBe('fulfilled')
      expect(effects).toHaveLength(1)
      const stored = await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true, depth: 0 })
      expect(stored.status).toBe('fulfilled')
      expect(stored.fulfilledAt).toBeTruthy()
      const licenses = await licensesOf(Number(carol.id))
      expect(licenses).toHaveLength(1)
      expect(licenses[0]).toMatchObject({ edition: editionId, product: 1, seats: 3, status: 'active', startsAt: '2026-11-16T10:00:00.000Z' })
      expect(licenses[0].key).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){4}$/)
      expect(licenses[0].expiresAt).toBe('2027-11-16T10:00:00.000Z')
      expect(stored.items?.[0].license).toBe(licenses[0].id)
      expect(await fulfillOrder(payload, order.id, { afterCommit: (r) => void effects.push(r) })).toEqual({ kind: 'noop', reason: 'already_fulfilled' })
      expect(effects).toHaveLength(1)
      expect(await licensesOf(Number(carol.id))).toHaveLength(1)
    })

    it('the same payment event twice → one licence', async () => {
      const { createPaymentEventStore, fulfillOrder } = await store()
      const { bodySha256, paymentEventKey } = await import('../../src/lib/payments/idempotency')
      const events = createPaymentEventStore(payload)
      const before = (await licensesOf(Number(carol.id))).length
      const order = await createOrder(Number(carol.id), 'paid')
      const event = { key: paymentEventKey('iyzico', 'iyz_same_event')!, provider: 'iyzico' as const, type: 'CHECKOUT_FORM_AUTH', bodySha256: bodySha256('{"token":"t"}'), receivedAt: new Date(), orderId: order.id }
      const deliver = async () => {
        if (!(await events.record(event))) return 'duplicate'
        const result = await fulfillOrder(payload, order.id)
        await events.mark(event.key, 'processed', { orderId: order.id })
        return result.kind
      }
      expect(await deliver()).toBe('fulfilled')
      expect(await deliver()).toBe('duplicate')
      expect(await licensesOf(Number(carol.id))).toHaveLength(before + 1)
      const { docs } = await payload.find({ collection: 'payment-events', where: { eventKey: { equals: event.key } }, overrideAccess: true, depth: 0 })
      expect(docs).toHaveLength(1)
      expect(docs[0]).toMatchObject({ status: 'processed', order: order.id })
    })

    it('does not report a rolled-back event as committed', async () => {
      const { createPaymentEventStore } = await store()
      const commit = payload.db.commitTransaction
      payload.db.commitTransaction = async (id) => { await payload.db.rollbackTransaction(id) }
      try {
        await expect(createPaymentEventStore(payload).record({ key: 'stripe:commit_failure', provider: 'stripe', type: 't', bodySha256: 'a'.repeat(64), receivedAt: new Date() })).rejects.toThrow('commit_unconfirmed')
      } finally {
        payload.db.commitTransaction = commit
      }
    })

    it('an event whose processing failed is processed again on redelivery (not lost)', async () => {
      const { createPaymentEventStore } = await store()
      const events = createPaymentEventStore(payload)
      const event = { key: 'stripe:evt_retry', provider: 'stripe' as const, type: 'checkout.session.completed', bodySha256: 'd'.repeat(64), receivedAt: new Date() }
      expect(await events.record(event)).toBe(true)
      await events.mark(event.key, 'error', { failureCode: 'sync_failed' })
      expect(await events.record(event)).toBe(true)
      await events.mark(event.key, 'ignored')
      await events.mark(event.key, 'error', { failureCode: 'late_failure' })
      expect(await events.record(event)).toBe(false)
    })

    it('two concurrent fulfilments → one licence, the other is a no-op', async () => {
      const { fulfillOrder } = await store()
      const before = (await licensesOf(Number(carol.id))).length
      const order = await createOrder(Number(carol.id), 'paid')
      const results = await Promise.all([fulfillOrder(payload, order.id), fulfillOrder(payload, order.id), fulfillOrder(payload, order.id)])
      expect(results.filter((r) => r.kind === 'fulfilled')).toHaveLength(1)
      expect(results.filter((r) => r.kind === 'noop' && r.reason === 'already_fulfilled')).toHaveLength(2)
      expect(await licensesOf(Number(carol.id))).toHaveLength(before + 1)
    })

    it('a failed conditional transition rolls everything back: no licence, order unchanged, no side effect', async () => {
      const { fulfillOrder } = await store()
      const before = (await licensesOf(Number(carol.id))).length
      const order = await createOrder(Number(carol.id), 'paid')
      const effects: unknown[] = []
      const result = await fulfillOrder(payload, order.id, {
        afterCommit: (r) => void effects.push(r),
        wrapStore: (s) => ({ ...s, transitionStatus: async () => 0 }),
      })
      expect(result).toEqual({ kind: 'conflict', reason: 'status_changed' })
      expect(effects).toHaveLength(0)
      expect(await licensesOf(Number(carol.id))).toHaveLength(before)
      const stored = await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true, depth: 0 })
      expect(stored.status).toBe('paid')
      expect(stored.items?.[0].license ?? null).toBeNull()

      // Real conditional SQL: the status moved away inside the transaction → 0 rows → full rollback.
      const moved = await fulfillOrder(payload, order.id, {
        wrapStore: (s) => ({
          ...s,
          issueLicense: async (orderId, itemId) => {
            const id = await s.issueLicense(orderId, itemId)
            await s.transitionStatus(orderId, 'paid', 'refunded')
            return id
          },
        }),
      })
      expect(moved).toEqual({ kind: 'conflict', reason: 'status_changed' })
      expect((await payload.findByID({ collection: 'orders', id: order.id, overrideAccess: true, depth: 0 })).status).toBe('paid')
      expect(await licensesOf(Number(carol.id))).toHaveLength(before)

      // Item already linked by someone else → rollback of the freshly issued licence.
      const linked = await fulfillOrder(payload, order.id, { wrapStore: (s) => ({ ...s, setItemLicense: async () => false }) })
      expect(linked).toEqual({ kind: 'conflict', reason: 'item_already_licensed' })
      expect(await licensesOf(Number(carol.id))).toHaveLength(before)

      // And afterwards the order still fulfils normally.
      expect((await fulfillOrder(payload, order.id)).kind).toBe('fulfilled')
      expect(await licensesOf(Number(carol.id))).toHaveLength(before + 1)
    })

    it('no licence for pending, review or incomplete orders; a failing licence write rolls back', async () => {
      const { fulfillOrder } = await store()
      const before = (await licensesOf(Number(carol.id))).length
      expect(await fulfillOrder(payload, (await createOrder(Number(carol.id), 'pending')).id)).toEqual({ kind: 'noop', reason: 'not_paid' })
      expect(await fulfillOrder(payload, (await createOrder(Number(carol.id), 'paid', { requiresReview: true })).id)).toEqual({ kind: 'noop', reason: 'requires_review' })
      expect(await fulfillOrder(payload, 999999)).toEqual({ kind: 'noop', reason: 'not_found' })
      const orphan = await createOrder(Number(carol.id), 'paid', { items: [{ ...orderData(0, 'paid').items[0], edition: null }] })
      expect(await fulfillOrder(payload, orphan.id)).toEqual({ kind: 'conflict', reason: 'order_incomplete' })
      const broken = await createOrder(Number(carol.id), 'paid')
      await expect(fulfillOrder(payload, broken.id, { wrapStore: (s) => ({ ...s, issueLicense: async () => { throw new Error('disk') } }) })).rejects.toThrow('disk')
      expect((await payload.findByID({ collection: 'orders', id: broken.id, overrideAccess: true, depth: 0 })).status).toBe('paid')
      expect(await licensesOf(Number(carol.id))).toHaveLength(before)
      // The process-wide transaction queue is free again afterwards.
      expect((await fulfillOrder(payload, broken.id)).kind).toBe('fulfilled')
    })
  })
})
