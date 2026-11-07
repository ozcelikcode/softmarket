import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  downloadsRead,
  isAdmin,
  isAdminOrEditor,
  isAdminOrOwnerCustomer,
  isOwnerCustomer,
  mediaRead,
  publishedOrStaff,
} from '../../src/access'

const admin = { id: 1, collection: 'users', roles: ['admin'] }
const editor = { id: 2, collection: 'users', roles: ['editor'] }
const customer = { id: 7, collection: 'customers' }

type FakeLicense = { product: number }

const makeReq = (user: unknown, licenses: FakeLicense[] = []) =>
  ({
    user,
    context: {},
    payload: { find: async ({ collection }: { collection: string }) => ({ docs: collection === 'licenses' ? licenses : [] }) },
  }) as unknown as PayloadRequest

const run = (fn: (args: never) => unknown, user: unknown, licenses?: FakeLicense[]) =>
  fn({ req: makeReq(user, licenses) } as never)

describe('role access', () => {
  it('isAdmin / isAdminOrEditor', () => {
    expect(run(isAdmin, admin)).toBe(true)
    expect(run(isAdmin, editor)).toBe(false)
    expect(run(isAdmin, { ...customer, roles: ['admin'] })).toBe(false)
    expect(run(isAdminOrEditor, editor)).toBe(true)
    expect(run(isAdminOrEditor, customer)).toBe(false)
    expect(run(isAdminOrEditor, null)).toBe(false)
  })

  it('publishedOrStaff', () => {
    expect(run(publishedOrStaff, editor)).toBe(true)
    expect(run(publishedOrStaff, null)).toEqual({ _status: { equals: 'published' } })
    expect(run(publishedOrStaff, customer)).toEqual({ _status: { equals: 'published' } })
  })

  it('isOwnerCustomer scopes customers to their own documents', () => {
    expect(run(isOwnerCustomer(), customer)).toEqual({ customer: { equals: 7 } })
    expect(run(isOwnerCustomer(), editor)).toBe(true)
    expect(run(isOwnerCustomer(), null)).toBe(false)
  })

  it('isAdminOrOwnerCustomer excludes editors (commerce data)', () => {
    expect(run(isAdminOrOwnerCustomer(), editor)).toBe(false)
    expect(run(isAdminOrOwnerCustomer(), admin)).toBe(true)
    expect(run(isAdminOrOwnerCustomer(), customer)).toEqual({ customer: { equals: 7 } })
  })
})

describe('licensed file access', () => {
  it.each([null, customer, admin])('returns 404 for a missing static filename for user %j', async user => {
    await expect(mediaRead({
      req: makeReq(user), data: { filename: 'yok' }, isReadingStaticFile: true,
    } as never)).rejects.toMatchObject({ status: 404 })
  })

  it('keeps the access filter for an existing static file', async () => {
    const req = makeReq(null)
    const find = vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'media' ? [{ id: 10 }] : [{ file: 10, product: 3, access: 'licensed' }],
      totalDocs: 1,
    }))
    req.payload.find = find as never
    const filter = { and: [
      { and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }] },
      { id: { not_in: [10] } },
    ] }
    expect(await mediaRead({
      req, data: { filename: 'protected.zip' }, isReadingStaticFile: true,
    } as never)).toEqual(filter)
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'media', where: { and: [{ or: ['filename', 'sizes.thumb.filename', 'sizes.card.filename', 'sizes.hero.filename', 'sizes.wide.filename'].map(field => ({ [field]: { equals: 'protected.zip' } })) }, filter] },
    }))
  })

  it('conceals an inaccessible static file as 404', async () => {
    const req = makeReq(null)
    req.payload.find = (async ({ collection }: { collection: string }) => ({
      docs: collection === 'downloads' ? [{ file: 10, product: 3, access: 'licensed' }] : [],
    })) as never
    await expect(mediaRead({ req, data: { filename: 'protected.zip' }, isReadingStaticFile: true } as never))
      .rejects.toMatchObject({ status: 404 })
  })

  it('anonymous users only see public downloads/media', async () => {
    expect(await run(downloadsRead, null)).toEqual({ access: { equals: 'public' } })
    expect(await run(mediaRead, null)).toEqual({
      and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }],
    })
  })

  it('customers without valid licenses only see public', async () => {
    expect(await run(downloadsRead, customer, [])).toEqual({ access: { equals: 'public' } })
  })

  it('customers with valid licenses also see licensed items of those products', async () => {
    const where = await run(downloadsRead, customer, [{ product: 3 }, { product: 3 }, { product: 5 }])
    expect(where).toEqual({
      or: [
        { access: { equals: 'public' } },
        { and: [{ access: { equals: 'licensed' } }, { product: { in: [3, 5] } }] },
      ],
    })
    const mediaWhere = (await run(mediaRead, customer, [{ product: 3 }])) as { or: unknown[] }
    expect(mediaWhere.or[1]).toEqual({
      and: [{ visibility: { equals: 'licensed' } }, { licensedProducts: { in: [3] } }],
    })
  })

  it('denies a shared file with a licensed reference unless the customer owns that product', async () => {
    const req = makeReq(customer, [])
    req.payload.find = (async ({ collection }: { collection: string }) => ({ docs: collection === 'licenses' ? [{ product: 3 }] : [
      { file: 10, product: 4, access: 'licensed' },
      { file: 11, product: 3, access: 'licensed' },
    ] })) as never
    expect(await mediaRead({ req } as never)).toEqual({ and: [
      { or: [ { or: [{ and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }] },
        { and: [{ visibility: { equals: 'licensed' } }, { licensedProducts: { in: [3] } }] }] },
        { id: { in: [11] } }] }, { id: { not_in: [10] } },
    ] })
  })

  it('a public reference cannot downgrade a licensed shared file', async () => {
    const req = makeReq(null)
    req.payload.find = (async () => ({ docs: [
      { file: 10, product: 4, access: 'licensed' },
      { file: 10, product: 4, access: 'public' },
      { file: 11, product: 4, access: 'public' },
    ] })) as never
    expect(await mediaRead({ req } as never)).toEqual({ and: [
      { or: [
        { and: [{ protected: { equals: false } }, { visibility: { equals: 'public' } }] },
        { id: { in: [11] } },
      ] },
      { id: { not_in: [10] } },
    ] })
  })

  it('staff see everything', async () => {
    expect(await run(downloadsRead, editor)).toBe(true)
    expect(await run(mediaRead, admin)).toBe(true)
  })
})
