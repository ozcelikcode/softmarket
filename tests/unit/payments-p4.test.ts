import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { readLimitedBody } from '../../src/lib/payments/body'
import { MAX_WEBHOOK_BYTES } from '../../src/lib/payments/providers/http'
import { forbiddenActionOrigin } from '../../src/lib/request-guards'

/*
 * P4 pure checks: streaming body limit, server-only boundary (client import graph), middleware/origin guard scope,
 * capability-off routes. The DB flow lives in payments-p4-db.test.ts.
 */

const streamOf = (chunks: Uint8Array[], onPull?: () => void) => {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      onPull?.()
      if (i < chunks.length) controller.enqueue(chunks[i++])
      else controller.close()
    },
  })
}
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('http://127.0.0.1/api/payments/iyzico/webhook', { method: 'POST', body, headers, duplex: 'half' } as RequestInit)

describe('readLimitedBody (256 KB, counted while streaming)', () => {
  it('accepts up to the limit and returns the exact text (BOM kept, UTF-8 multi-byte intact)', async () => {
    const text = '﻿{"a":"ğüşİ"}'
    expect(await readLimitedBody(post(text), MAX_WEBHOOK_BYTES)).toEqual({ ok: true, text })
    const exact = 'x'.repeat(MAX_WEBHOOK_BYTES)
    expect(await readLimitedBody(post(exact), MAX_WEBHOOK_BYTES)).toEqual({ ok: true, text: exact })
    expect(await readLimitedBody(post(null), MAX_WEBHOOK_BYTES)).toEqual({ ok: true, text: '' })
  })

  it('rejects one byte over the limit, without trusting a missing or smaller Content-Length, and stops reading early', async () => {
    expect(await readLimitedBody(post('x'.repeat(MAX_WEBHOOK_BYTES + 1)), MAX_WEBHOOK_BYTES)).toEqual({ ok: false, reason: 'too_large' })
    let pulls = 0
    const chunk = new Uint8Array(64 * 1024).fill(120)
    const endless = Array.from({ length: 1000 }, () => chunk) // 64 MB if fully read
    const lying = post(streamOf(endless, () => pulls++), { 'content-length': '10' })
    expect(await readLimitedBody(lying, MAX_WEBHOOK_BYTES)).toEqual({ ok: false, reason: 'too_large' })
    expect(pulls).toBeLessThan(10)
  })

  it('rejects early on a declared oversize and returns malformed for invalid UTF-8', async () => {
    let pulls = 0
    const declared = post(streamOf([new Uint8Array(10)], () => pulls++), { 'content-length': String(MAX_WEBHOOK_BYTES + 1) })
    expect(await readLimitedBody(declared, MAX_WEBHOOK_BYTES)).toEqual({ ok: false, reason: 'too_large' })
    expect(pulls).toBeLessThanOrEqual(1)
    expect(await readLimitedBody(post(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])), MAX_WEBHOOK_BYTES)).toEqual({ ok: false, reason: 'malformed' })
  })
})

describe('server-only boundary: no client component reaches server payment code', () => {
  const SRC = join(process.cwd(), 'src')
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : []
  })
  const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  const resolveImport = (from: string, spec: string): string | null => {
    const base = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null
    if (!base) return null
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
    return null
  }
  const importsOf = (file: string) => {
    const code = strip(readFileSync(file, 'utf8'))
    // Type-only imports are erased and never reach a bundle.
    const specs = [
      ...[...code.matchAll(/^\s*(?:import|export)(?!\s+type\b)[^'"]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
      ...[...code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]!),
      ...[...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]!),
    ]
    return specs.map((s) => resolveImport(file, s)).filter((p): p is string => p !== null)
  }

  it('the transitive client import graph only touches the pure, node-free payment modules', () => {
    const roots = walk(SRC).filter((p) => /^\s*['"]use client['"]/.test(readFileSync(p, 'utf8')))
    expect(roots.length).toBeGreaterThan(5)
    const seen = new Set<string>()
    const queue = [...roots]
    while (queue.length) {
      const file = queue.pop()!
      if (seen.has(file)) continue
      seen.add(file)
      // A 'use server' module is a Server Action boundary: the client bundle only receives an action reference.
      if (/^\s*['"]use server['"]/.test(readFileSync(file, 'utf8')) && !roots.includes(file)) continue
      queue.push(...importsOf(file))
    }
    const rel = [...seen].map((p) => p.slice(SRC.length + 1))
    const payments = rel.filter((p) => p.startsWith('lib/payments/')).sort()
    expect(payments.filter((p) => !['lib/payments/price-input.ts', 'lib/payments/money.ts', 'lib/payments/types.ts'].includes(p))).toEqual([])
    expect(rel.filter((p) => /^lib\/(email|commerce)\/|^app\/\(payload\)\/api\/payments\//.test(p))).toEqual([])
    // Server Action modules are reached (as references) but their server imports are not followed.
    expect(rel).toContain('lib/forms/action.ts')
  })

  it('P4 server modules are only imported by routes, other server payment modules, emails and the CLI', () => {
    const p4 = ['runtime', 'events', 'sync', 'fulfill', 'reconcile', 'route', 'body']
    const importers = walk(SRC).filter((file) => importsOf(file).some((dep) => p4.some((m) => dep === join(SRC, `lib/payments/${m}.ts`))))
      .map((p) => p.slice(SRC.length + 1))
    // P5: the checkout Server Action and the Stripe-return sync are the only portal modules that build payment deps.
    for (const file of importers) expect(file).toMatch(/^(lib\/payments\/|lib\/email\/order-|app\/\(payload\)\/api\/payments\/|lib\/portal\/checkout-(actions|orders)\.ts$)/)
  })
})

describe('origin guard and middleware do not touch /api/payments; CSP for pages unchanged', () => {
  it('middleware matcher excludes the payment routes (no Server Action origin check, no page CSP/nonce)', async () => {
    const { config } = await import('../../src/middleware')
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    for (const path of ['/api/payments/iyzico/webhook', '/api/payments/iyzico/callback', '/api/payments/stripe/webhook']) expect(matcher.test(path)).toBe(false)
    expect(matcher.test('/tr/urunler')).toBe(true)
  })

  it('the Server Action origin guard only concerns Next-Action POSTs (cross-site provider POSTs pass)', () => {
    const iyzico = new Headers({ origin: 'https://sandbox-api.iyzipay.com', host: 'shop.example', 'content-type': 'application/x-www-form-urlencoded' })
    expect(forbiddenActionOrigin('POST', iyzico)).toBe(false)
    expect(forbiddenActionOrigin('POST', new Headers({ host: 'shop.example', 'stripe-signature': 't=1,v1=x' }))).toBe(false)
    iyzico.set('next-action', 'abc')
    expect(forbiddenActionOrigin('POST', iyzico)).toBe(true)
  })
})

describe('routes without the env capability', () => {
  const saved = { ...process.env }
  afterEach(() => { process.env = { ...saved } })

  const ROUTES = {
    'iyzico/webhook': () => import('../../src/app/(payload)/api/payments/iyzico/webhook/route'),
    'iyzico/callback': () => import('../../src/app/(payload)/api/payments/iyzico/callback/route'),
    'stripe/webhook': () => import('../../src/app/(payload)/api/payments/stripe/webhook/route'),
  }
  it.each(Object.keys(ROUTES) as (keyof typeof ROUTES)[])('%s → 404 before Payload or the DB is touched; only POST is exported', async (path) => {
    delete process.env.PAYMENTS_ENABLED
    const mod = (await ROUTES[path]()) as unknown as Record<string, unknown> & { POST: (r: Request) => Promise<Response>; dynamic: string; runtime: string }
    expect(Object.keys(mod).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['POST'])
    expect(mod.dynamic).toBe('force-dynamic')
    expect(mod.runtime).toBe('nodejs')
    const res: Response = await mod.POST(post('{}', { 'x-iyz-signature-v3': 'a'.repeat(64) }))
    expect(res.status).toBe(404)
    expect(await res.text()).toBe('')
    process.env.PAYMENTS_ENABLED = '1'
    expect((await mod.POST(post('{}'))).status).toBe(404)
  })
  it.each(Object.keys(ROUTES) as (keyof typeof ROUTES)[])('%s → 404 without a configured adapter', async (path) => {
    process.env.PAYMENTS_ENABLED = 'true'
    delete process.env.PAYMENTS_STRIPE_ENABLED
    delete process.env.IYZICO_API_KEY
    const mod = await ROUTES[path]()
    expect((await mod.POST(post('{}'))).status).toBe(404)
  })
})
