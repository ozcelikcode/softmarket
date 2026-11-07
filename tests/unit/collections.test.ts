import { describe, expect, it } from 'vitest'

import { Customers } from '../../src/collections/Customers'
import { Downloads } from '../../src/collections/Downloads'
import { Editions } from '../../src/collections/Editions'
import { Licenses } from '../../src/collections/Licenses'
import { Media } from '../../src/collections/Media'
import { SupportTicketMessages } from '../../src/collections/SupportTicketMessages'
import { SupportTickets } from '../../src/collections/SupportTickets'
import { Users } from '../../src/collections/Users'

const customer = { id: 7, collection: 'customers' }
const call = (fn: unknown, user: unknown) =>
  (fn as (args: { req: { user: unknown } }) => unknown)({ req: { user } })

describe('collection security invariants', () => {
  it('keeps users/customers auth and media uploads enabled', () => {
    expect(Users.slug).toBe('users')
    expect(Users.auth).toBeTruthy()
    expect(Customers.auth).toMatchObject({ verify: expect.any(Object) })
    expect(Media.slug).toBe('media')
    expect(Media.upload).toBeTruthy()
  })

  it('never lets customers into the admin panel', () => {
    expect(call(Customers.access?.admin, customer)).toBe(false)
    expect(call(Users.access?.admin, customer)).toBe(false)
  })

  it('never lets customers write licenses', () => {
    for (const collection of [Licenses]) {
      for (const op of ['create', 'update', 'delete'] as const) {
        expect(call(collection.access?.[op], customer)).toBe(false)
      }
    }
  })

  it('logged-in customers cannot create additional customer accounts', () => {
    expect(call(Customers.access?.create, customer)).toBe(false)
    expect(call(Customers.access?.create, null)).toBe(false)
  })
})

describe('collection change hooks', () => {
  const runHook = async (collection: typeof Licenses, args: Record<string, unknown>) => {
    const hook = collection.hooks?.beforeChange?.[0] as (args: never) => unknown
    return hook(args as never)
  }

  it('preserves ticket messages when staff update other fields', async () => {
    const data = { status: 'closed' }
    expect(await runHook(SupportTickets, {
      data, originalDoc: { messages: [{ body: 'existing' }] }, operation: 'update',
      req: { user: { id: 1, collection: 'users', roles: ['editor'] } },
    })).toEqual(data)
  })

  it('forces message authorship and rejects messages on another customer ticket', async () => {
    const hook = SupportTicketMessages.hooks?.beforeChange?.[0] as (args: never) => Promise<unknown>
    const req = { user: customer, payload: { find: async () => ({ docs: [{ id: 1 }] }) } }
    expect(await hook({ data: { ticket: 1, body: 'hello', author: 'staff', staffUser: 3 }, req } as never))
      .toEqual({ ticket: 1, body: 'hello', author: 'customer', staffUser: null })
    req.payload.find = async () => ({ docs: [] })
    await expect(hook({ data: { ticket: 2, body: 'hello' }, req } as never)).rejects.toThrow()
    expect(call(SupportTicketMessages.access?.update, customer)).toBe(false)
    expect(call(SupportTicketMessages.access?.delete, customer)).toBe(false)
  })

  it('rejects messages on closed tickets for customers and staff', async () => {
    const hook = SupportTicketMessages.hooks?.beforeChange?.[0] as (args: never) => Promise<unknown>
    for (const user of [customer, { id: 1, collection: 'users', roles: ['editor'] }]) {
      await expect(hook({ data: { ticket: 1, body: 'closed' }, req: {
        user, payload: { find: async () => ({ docs: [{ id: 1, status: 'closed' }] }) },
      } } as never)).rejects.toThrow()
    }
  })

  it('checks product entitlement for direct customer ticket creates and forces ownership/status', async () => {
    const req = { user: customer, context: {}, payload: { find: async () => ({ docs: [{ product: 12 }] }) } }
    expect(await runHook(SupportTickets, { operation: 'create', req, data: { subject: 'Test ticket', product: 12, customer: 99, status: 'closed', priority: 'urgent' } }))
      .toEqual({ subject: 'Test ticket', product: 12, customer: 7, status: 'open', priority: 'normal' })
    await expect(runHook(SupportTickets, { operation: 'create', req, data: { subject: 'Test ticket', product: 13 } })).rejects.toThrow()
    await expect(runHook(SupportTickets, { operation: 'create', req, data: { subject: 'Test ticket' } })).rejects.toThrow()
  })

  it('defaults uploads to protected and never clears existing protection', async () => {
    const field = Media.fields.find((f) => 'name' in f && f.name === 'protected')
    expect(field).toMatchObject({ defaultValue: true, required: true })
    const hook = (field as { hooks: { beforeChange: ((args: unknown) => unknown)[] } }).hooks.beforeChange[0]
    expect(await hook({ value: false, originalDoc: { protected: true } })).toBe(true)
    expect(await hook({ value: false, originalDoc: undefined })).toBe(false)
  })

  it('rejects attaching a public unprotected upload to a download', async () => {
    const data = { file: 10, access: 'licensed' }
    await expect(runHook(Downloads, { data, req: {
      payload: { findByID: async () => ({ id: 10, protected: false }) },
    } })).rejects.toThrow()
    expect(await runHook(Downloads, { data, req: {
      payload: { findByID: async () => ({ id: 10, protected: true }) },
    } })).toEqual(data)
  })

  it('requires whole subscription months', () => {
    const field = Editions.fields.find((f) => 'name' in f && f.name === 'durationMonths')
    const validate = (field as { validate: (value: number, options: unknown) => unknown }).validate
    expect(validate(1.5, { siblingData: { licenseType: 'subscription' } })).not.toBe(true)
    expect(validate(12, { siblingData: { licenseType: 'subscription' } })).toBe(true)
  })
})
