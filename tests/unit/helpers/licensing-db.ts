import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Payload } from 'payload'

/*
 * Shared setup for the L1 licensing DB tests: a temporary SQLite with every migration, real Payload auth (panel
 * session cookie vs users API key), and REST/GraphQL handlers called in process. Never touches data/softmarket.db.
 */
export const ORIGIN = 'http://127.0.0.1:3100'
export const ADMIN = { email: 'admin.l1@example.test', password: 'Admin-l1-password-123' }
export const EDITOR = { email: 'editor.l1@example.test', password: 'Editor-l1-password-123' }
export const CUSTOMER = { email: 'customer.l1@example.test', password: 'Customer-l1-password-123' }
export const OTHER_CUSTOMER = { email: 'other.l1@example.test', password: 'Other-l1-password-123' }
export const API_KEY = 'l1-admin-api-key-0123456789abcdef'

export type Principal = 'anonymous' | 'customer' | 'editor' | 'apiKey' | 'adminBearer' | 'admin'
export type Ctx = {
  payload: Payload
  dir: string
  ids: { admin: number; editor: number; customer: number; otherCustomer: number; family: number; product: number; edition: number }
  headers: Record<Principal, Record<string, string>>
  run: (query: string) => Promise<{ rows: Record<string, unknown>[] }>
  rest: (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, principal: Principal, body?: unknown) => Promise<{ status: number; json: Record<string, unknown> }>
  graphql: (query: string, principal: Principal) => Promise<{ status: number; text: string }>
  destroy: () => Promise<void>
}

const config = async () => (await import('../../../src/payload.config')).default

export async function setupLicensingDb(prefix: string): Promise<Ctx> {
  const dir = mkdtempSync(join(tmpdir(), `softmarket-${prefix}-`))
  process.env.DATABASE_URI = `file:${dir}/test.db`
  process.env.UPLOADS_DIR = join(dir, 'uploads')
  process.env.PAYLOAD_SECRET ||= 'test-secret-long-enough-for-payload'
  for (const k of ['SMTP_HOST', 'SMTP_FROM', 'SMTP_USER', 'SMTP_PASSWORD', 'PAYMENTS_ENABLED']) delete process.env[k]
  const { getPayload } = await import('payload')
  const payload = await getPayload({ config: await config() })
  const { migrations } = await import('../../../src/migrations')
  type MigrateArgs = NonNullable<Parameters<Payload['db']['migrate']>[0]>['migrations']
  await payload.db.migrate({ migrations: migrations as unknown as MigrateArgs })
  const run = async (query: string) => ({ rows: (await payload.db.drizzle.$client.execute(query)).rows as unknown as Record<string, unknown>[] })

  const user = async (data: Record<string, unknown>) => (await payload.create({ collection: 'users', overrideAccess: true, data: data as never })).id as number
  const admin = await user({ ...ADMIN, name: 'Admin', roles: ['admin'], enableAPIKey: true, apiKey: API_KEY })
  const editor = await user({ ...EDITOR, name: 'Editor', roles: ['editor'] })
  const customerOf = async (data: { email: string; password: string }, name: string) => (await payload.create({
    collection: 'customers', overrideAccess: true, disableVerificationEmail: true, data: { ...data, name, _verified: true } as never,
  })).id as number
  const customer = await customerOf(CUSTOMER, 'Customer')
  const otherCustomer = await customerOf(OTHER_CUSTOMER, 'Other')
  const family = (await payload.create({ collection: 'product-families', overrideAccess: true, locale: 'tr', data: { title: 'Aile L1', slug: 'aile-l1', _status: 'published' } as never })).id as number
  const product = (await payload.create({ collection: 'products', overrideAccess: true, locale: 'tr', data: { title: 'Ürün L1', slug: 'urun-l1', family, _status: 'published' } as never })).id as number
  const edition = (await payload.create({ collection: 'editions', overrideAccess: true, locale: 'tr', data: { title: 'Pro', sku: 'L1-PRO', product, licenseType: 'perpetual', seats: 2 } as never })).id as number

  const token = async (collection: 'users' | 'customers', data: { email: string; password: string }) => (await payload.login({ collection, data })).token!
  const session = (jwt: string) => ({ origin: ORIGIN, 'sec-fetch-site': 'same-origin', cookie: `payload-token=${jwt}` })
  const adminToken = await token('users', ADMIN)
  const headers: Ctx['headers'] = {
    anonymous: { origin: ORIGIN },
    customer: session(await token('customers', CUSTOMER)),
    editor: session(await token('users', EDITOR)),
    apiKey: { origin: ORIGIN, authorization: `users API-Key ${API_KEY}` },
    adminBearer: { origin: ORIGIN, authorization: `Bearer ${adminToken}` },
    admin: session(adminToken),
  }

  const rest: Ctx['rest'] = async (method, path, principal, body) => {
    const routes = await import('@payloadcms/next/routes')
    const cfg = await config()
    const handler = { GET: routes.REST_GET, POST: routes.REST_POST, PATCH: routes.REST_PATCH, DELETE: routes.REST_DELETE }[method](cfg)
    const [pathname, search] = path.split('?')
    const slug = pathname!.split('/').filter(Boolean)
    const res = await handler(new Request(`${ORIGIN}/api/${slug.join('/')}${search ? `?${search}` : ''}`, {
      method,
      headers: {
        host: '127.0.0.1:3100',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(pathname === 'mcp' ? { accept: 'application/json, text/event-stream' } : {}),
        ...headers[principal],
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }), { params: Promise.resolve({ slug }) })
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) as Record<string, unknown> } catch { json = { raw: text } }
    return { status: res.status, json }
  }
  const graphql: Ctx['graphql'] = async (query, principal) => {
    const { GRAPHQL_POST } = await import('@payloadcms/next/routes')
    const res = await GRAPHQL_POST(await config())(new Request(`${ORIGIN}/api/graphql`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers[principal] }, body: JSON.stringify({ query }),
    }))
    return { status: res.status, text: await res.text() }
  }

  return {
    payload, dir, run, rest, graphql, headers,
    ids: { admin, editor, customer, otherCustomer, family, product, edition },
    destroy: async () => { await payload.destroy(); rmSync(dir, { recursive: true, force: true }) },
  }
}

export async function createLicense(ctx: Ctx, customer = ctx.ids.customer): Promise<{ id: number; publicId: string }> {
  const doc = await ctx.payload.create({
    collection: 'licenses', overrideAccess: true,
    data: { customer, edition: ctx.ids.edition, startsAt: '2026-01-01T00:00:00.000Z' } as never,
    // Skip the assignment e-mail hook (no SMTP in tests anyway).
    context: { paymentsOrderFulfilment: true },
  })
  return { id: doc.id as number, publicId: String((doc as { publicId?: unknown }).publicId) }
}
