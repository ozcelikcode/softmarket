import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LicenseActions as LicenseActionsField } from '@/admin/fields/license-actions'
import { SigningKeyRotate as SigningKeyRotateField } from '@/admin/fields/signing-key-rotate'
import { BlocksTable, EventsTable, type ViewEnv } from '@/admin/security/parts'
import { SECURITY_CENTER_LABELS } from '@/lib/security-center-labels'
import { createLicense, setupLicensingDb, type Ctx } from './helpers/licensing-db'
import { insertActivation } from './helpers/licensing-sweep'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT:${to}`) } }))

/*
 * L6b UI guard: the license side panel, the signing key button and the security center action columns render only for
 * an admin's panel session; editors, customers, API-key/bearer admins see nothing. The rendered panel carries ids and
 * states only (no license key, device key, fingerprint hash or IP hash).
 */
type ServerField = (props: unknown) => React.ReactNode | Promise<React.ReactNode>
const LicenseActions = LicenseActionsField as unknown as ServerField
const SigningKeyRotate = SigningKeyRotateField as unknown as ServerField

let ctx: Ctx
let license: { id: number; publicId: string }
let device: number

const userOf = async (collection: 'users' | 'customers', id: number, strategy: string) =>
  ({ ...(await ctx.payload.findByID({ collection, id, overrideAccess: true, depth: 0 })), collection, _strategy: strategy })
const reqFor = (user: unknown, headers = new Headers({ cookie: 'payload-token=x' })) =>
  ({ payload: ctx.payload, user, headers, i18n: { language: 'en' }, context: {} }) as never
const render = async (node: unknown) => (node ? renderToStaticMarkup(node as React.ReactElement) : '')

beforeAll(async () => {
  ctx = await setupLicensingDb('l6b-ui')
  license = await createLicense(ctx)
  device = await insertActivation(ctx, license.id, { prefix: '203.0.113.0/24', ipHash: 'ip-hash-should-not-render' })
}, 240_000)
afterAll(async () => { await ctx?.destroy() })

describe('license side panel', () => {
  it('renders nothing for editors, customers, API-key and bearer admins', async () => {
    const cases = [
      await userOf('users', ctx.ids.editor, 'local-jwt'),
      await userOf('customers', ctx.ids.customer, 'local-jwt'),
      await userOf('users', ctx.ids.admin, 'api-key'),
    ]
    for (const user of cases) {
      expect(await LicenseActions({ req: reqFor(user), id: license.id } as never)).toBeNull()
      expect(await SigningKeyRotate({ req: reqFor(user), data: {} } as never)).toBeNull()
    }
    const admin = await userOf('users', ctx.ids.admin, 'local-jwt')
    const bearer = new Headers({ authorization: 'Bearer x' })
    expect(await LicenseActions({ req: reqFor(admin, bearer), id: license.id } as never)).toBeNull()
    expect(await SigningKeyRotate({ req: reqFor(admin, bearer), data: {} } as never)).toBeNull()
  })

  it('shows status, devices, history and the allowed actions to a panel admin without secrets', async () => {
    const admin = await userOf('users', ctx.ids.admin, 'local-jwt')
    const html = await render(await LicenseActions({ req: reqFor(admin), id: license.id } as never))
    expect(html).toContain('data-license-actions')
    expect(html).toContain(SECURITY_CENTER_LABELS.actions.panel.title.en)
    expect(html).toContain('data-sc-action-open="license-suspend"')
    expect(html).toContain('data-sc-action-open="license-revoke"')
    expect(html).not.toContain('data-sc-action-open="license-restore"')
    expect(html).toContain(`data-sc-action-open="device-${device}-release"`)
    expect(html).toContain('203.0.113.0/24')
    const secrets = (await ctx.run(`SELECT l.key, a.fingerprint_hash AS fp, a.device_public_key AS dk, a.device_key_thumbprint AS th
      FROM licenses l JOIN license_activations a ON a.license_id = l.id WHERE l.id = ${license.id}`)).rows[0]!
    for (const value of [secrets.key, secrets.fp, secrets.dk, secrets.th, 'ip-hash-should-not-render']) expect(html).not.toContain(String(value))
    expect(html).not.toContain(license.publicId)

    const rotate = await render(await SigningKeyRotate({ req: reqFor(admin), data: { signingKeys: [{ kid: 'kid-public-1' }] } } as never))
    expect(rotate).toContain('data-sc-action-open="signing-rotate"')
    expect(rotate).toContain('kid-public-1')
  })
})

describe('security center action columns', () => {
  const event = {
    id: 7, href: '/admin/collections/security-events/7', type: 'api.replay', severity: 'high', source: 'api', count: 1, triage: 'open',
    actionTaken: null, firstSeenAt: null, lastSeenAt: null, ipPrefix: '198.51.100.0/24', ipHash: '', country: '', ruleKey: '',
    detail: { entries: [], truncated: false }, license: null, activation: null, customer: null, order: null, actor: null,
  }
  const block = {
    id: 3, href: '/admin/collections/security-blocks/3', kind: 'ip_prefix', value: '198.51.100.0/24', scope: 'api', source: 'admin',
    reason: 'x', state: 'active' as const, createdAt: null, expiresAt: null, liftedAt: null, liftReason: '', event: null,
  }
  const env = (canAct: boolean): ViewEnv => ({ lang: 'en', base: '/admin/guvenlik', adminRoute: '/admin', canAct })

  it('renders no action widgets unless the view decided the admin session may act', () => {
    const off = renderToStaticMarkup(<><EventsTable rows={[event as never]} env={env(false)} caption={SECURITY_CENTER_LABELS.tableCaption.events} /><BlocksTable rows={[block]} env={env(false)} /></>)
    expect(off).not.toContain('data-sc-action')
    const on = renderToStaticMarkup(<><EventsTable rows={[event as never]} env={env(true)} caption={SECURITY_CENTER_LABELS.tableCaption.events} /><BlocksTable rows={[block]} env={env(true)} /></>)
    for (const id of ['event-7-acknowledge', 'event-7-resolve', 'event-7-false-positive', 'event-7-block', 'block-3-lift']) expect(on).toContain(`data-sc-action-open="${id}"`)
    expect(on).not.toContain('event-7-restore')
  })

  it('HTML-escapes malicious reasons, notes and device labels in server-rendered markup', async () => {
    const admin = await userOf('users', ctx.ids.admin, 'local-jwt')
    const xss = '<img src=x onerror=alert(1)>'
    const evilDevice = await insertActivation(ctx, license.id, { prefix: '203.0.113.0/24' })
    await ctx.run(`UPDATE license_activations SET device_label = '${xss}' WHERE id = ${evilDevice}`)
    const sidePanel = await render(await LicenseActions({ req: reqFor(admin), id: license.id } as never))
    expect(sidePanel).not.toContain('<img src=x')
    expect(sidePanel).toContain('&lt;img src=x onerror=alert(1)&gt;')

    const xssBlock = { ...block, reason: xss, liftReason: '<script>evil()</script>' }
    const blocksHtml = renderToStaticMarkup(<BlocksTable rows={[xssBlock]} env={env(true)} />)
    expect(blocksHtml).not.toContain('<img src=x')
    expect(blocksHtml).not.toContain('<script>')
    expect(blocksHtml).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(blocksHtml).toContain('&lt;script&gt;evil()&lt;/script&gt;')
  })
})
