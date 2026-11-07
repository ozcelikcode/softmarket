import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { mcpCollections, mcpGlobals, mcpOptions } from '../../src/lib/mcp'
import { Users, adminAPIKeysOnly } from '../../src/collections/Users'

const authenticate = async (authorization: string | undefined, user: unknown) => {
  const auth = vi.fn(async () => ({ user }))
  const req = { headers: new Headers(authorization ? { authorization, cookie: 'payload-token=session' } : {}), payload: { auth } } as unknown as PayloadRequest
  const promise = mcpOptions.overrideAuth!(req, vi.fn())
  return { promise, auth }
}
describe('MCP allowlist and API authentication', () => {
  it('exposes exactly the approved collections/globals', () => {
    expect(Object.keys(mcpCollections).sort()).toEqual(['product-families','products','editions','solutions','industries','case-studies','posts','careers','partners','pages','docs','releases','downloads','faqs','media','licenses'].sort())
    expect(Object.keys(mcpGlobals).sort()).toEqual(['header','footer','site-settings'].sort())
    expect(mcpCollections.licenses.enabled).toEqual({ create: true, find: true, update: true, delete: false })
    expect(mcpOptions.experimental).toBeUndefined()
    expect(Users.auth).toMatchObject({ useAPIKey: true })
  })
  it.each([null, { collection: 'customers', roles: ['admin'], _strategy: 'api-key' }, { collection: 'users', roles: ['editor'], _strategy: 'api-key' }, { collection: 'users', roles: ['admin'], _strategy: 'local-jwt' }])('rejects anonymous, customer, editor, and session auth', async user => {
    const { promise } = await authenticate('Bearer test-key', user)
    await expect(promise).rejects.toThrow()
  })
  it('rejects missing Bearer/API-Key even with an authenticated admin session', async () => {
    const { promise, auth } = await authenticate(undefined, { collection: 'users', roles: ['admin'], _strategy: 'api-key' })
    await expect(promise).rejects.toThrow(); expect(auth).not.toHaveBeenCalled()
  })
  it('authenticates the users API key without forwarding cookies, with a restricted capability map', async () => {
    const { promise, auth } = await authenticate('Bearer test-key', { id: 1, collection: 'users', roles: ['admin'], _strategy: 'api-key' })
    const result = await promise
    expect(auth.mock.calls[0]).toBeDefined()
    const headers = (auth.mock.calls as unknown as [{ headers: Headers }][])[0][0].headers
    expect(headers.get('authorization')).toBe('users API-Key test-key')
    expect(headers.get('cookie')).toBeNull()
    expect(result).toMatchObject({ productFamilies: { create: true }, siteSettings: { update: true }, licenses: { delete: false } })
    expect(result).not.toHaveProperty('customers'); expect(result).not.toHaveProperty('users')
  })
  it('protects API key fields from editor reads and writes and revokes keys on downgrade', async () => {
    for (const field of Users.fields.filter(f => 'name' in f && ['apiKey', 'apiKeyIndex', 'enableAPIKey'].includes(f.name))) {
      for (const op of ['create', 'read', 'update'] as const) {
        const access = 'access' in field && field.access?.[op]
        expect(await (access as (args: unknown) => unknown)({ req: { user: { collection: 'users', roles: ['editor'] } } })).toBe(false)
      }
    }
    expect(await adminAPIKeysOnly({ data: { roles: ['editor'], apiKey: 'x', enableAPIKey: true }, originalDoc: { roles: ['admin'] } } as never)).toMatchObject({ enableAPIKey: false, apiKey: null, apiKeyIndex: null })
  })
  it('prevents relationship population and server-side file reads in MCP operations', async () => {
    const find = vi.fn(async () => ({}))
    const update = vi.fn(async () => ({}))
    const req = { headers: new Headers({ authorization: 'Bearer key' }), payload: { auth: async () => ({ user: { id: 1, collection: 'users', roles: ['admin'], _strategy: 'api-key' } }), find, update } } as unknown as PayloadRequest
    await mcpOptions.overrideAuth!(req, vi.fn())
    await req.payload.find({ collection: 'licenses', depth: 5 } as never)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'licenses', depth: 0 }))
    expect(() => req.payload.update({ collection: 'media', id: 1, filePath: '/etc/passwd' } as never)).toThrow('file paths')
    expect(update).not.toHaveBeenCalled()
  })
})
