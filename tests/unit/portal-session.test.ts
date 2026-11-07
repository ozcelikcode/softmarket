import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  setCookie: vi.fn(), authenticate: vi.fn(), logout: vi.fn(),
  payload: { collections: { customers: {} } },
}))
vi.mock('react', () => ({ cache: (fn: unknown) => fn }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mock.cookie ? { value: mock.cookie } : undefined, set: mock.setCookie }) }))
vi.mock('@/lib/site', () => ({ getPayloadClient: async () => mock.payload }))
vi.mock('@/lib/portal/strategy', () => ({ portalCookieStrategy: { authenticate: mock.authenticate } }))
vi.mock('payload', () => ({ createLocalReq: async ({ user }: { user: unknown }) => ({ user }), logoutOperation: mock.logout }))

import { clearSession, endSession, getCustomer, setSession } from '@/lib/portal/session'
import { PORTAL_COOKIE } from '@/lib/portal/cookie'

beforeEach(() => {
  vi.clearAllMocks()
  mock.cookie = 'aaa.bbb.ccc'
  mock.authenticate.mockResolvedValue({ user: { id: 7, collection: 'customers', _sid: 'session-7' } })
  mock.logout.mockResolvedValue(true)
})
describe('portal session lifecycle', () => {
  it('uses the current dedicated strategy and never the shared admin token', async () => {
    expect(await getCustomer()).toMatchObject({ id: 7, collection: 'customers' })
    const args = mock.authenticate.mock.calls[0][0]
    expect(args.headers.get('cookie')).toBe(`${PORTAL_COOKIE}=aaa.bbb.ccc`)
    mock.authenticate.mockResolvedValue({ user: { id: 7, collection: 'users' } })
    expect(await getCustomer()).toBeNull()
  })
  it('does not authenticate absent or malformed cookies', async () => {
    mock.cookie = undefined
    expect(await getCustomer()).toBeNull()
    mock.cookie = 'not-a-jwt'
    expect(await getCustomer()).toBeNull()
    expect(mock.authenticate).not.toHaveBeenCalled()
  })
  it.each([false, true])('sets HttpOnly/Lax/root-path cookies and Secure in production=%s', async (production) => {
    vi.stubEnv('NODE_ENV', production ? 'production' : 'development')
    try {
      await setSession('token')
      expect(mock.setCookie).toHaveBeenCalledWith(PORTAL_COOKIE, 'token', expect.objectContaining({ httpOnly: true, sameSite: 'lax', secure: production, path: '/' }))
      await clearSession()
      expect(mock.setCookie).toHaveBeenLastCalledWith(PORTAL_COOKIE, '', expect.objectContaining({ maxAge: 0, httpOnly: true, sameSite: 'lax', secure: production, path: '/' }))
    } finally { vi.unstubAllEnvs() }
  })
  it('preserves the authenticated sid when revoking the current server session', async () => {
    await endSession()
    expect(mock.logout).toHaveBeenCalledWith({ collection: mock.payload.collections.customers, req: { user: { id: 7, collection: 'customers', _sid: 'session-7' } } })
    expect(mock.setCookie).toHaveBeenCalled()
  })
  it('does not claim logout success when server-side revocation fails', async () => {
    mock.logout.mockRejectedValue(new Error('database unavailable'))
    await expect(endSession()).rejects.toThrow('database unavailable')
    expect(mock.setCookie).not.toHaveBeenCalled()
  })
  it('uses the __Host- cookie namespace on production startup', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect((await import('@/lib/portal/cookie')).PORTAL_COOKIE).toBe('__Host-sm_customer')
    } finally { vi.unstubAllEnvs() }
  })
})
