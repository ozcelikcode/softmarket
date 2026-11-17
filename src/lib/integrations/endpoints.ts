import type { PayloadRequest } from 'payload'

import { emailTemplate } from '@/lib/email/template'
import { createRateLimiter } from '@/lib/forms/security'
import { readLimitedBody } from '@/lib/payments/body'
import { guardAdminSession } from '@/lib/payments/admin-endpoints'
import { isSecretId, validateSecretInput } from './ids'
import { writeSecret } from './vault'

/*
 * Admin-only integration endpoints (global endpoints, so they share Payload's auth):
 *   POST /api/globals/integrations/secret       { id, value } sets, { id, clear: true } clears one write-only secret
 *   POST /api/globals/integrations/test-email   sends a test message to the signed-in admin's OWN address
 *
 * Access = an admin's PANEL SESSION + same origin (guardAdminSession: anonymous 401, customer/editor 403, users API
 * key / MCP / Authorization header 403, cross-site 403). Responses are `no-store` JSON with short codes only: the
 * secret value is never echoed, logged or stored outside the encrypted record; transport errors are never echoed.
 */

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })

const MAX_BODY = 4096

export async function handleSecretWrite(req: PayloadRequest): Promise<Response> {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const guard = guardAdminSession(req)
  if (!guard.ok) return guard.response
  const body = await readLimitedBody(req as unknown as Request, MAX_BODY)
  if (!body.ok) return json(400, { code: body.reason })
  let input: { id?: unknown; value?: unknown; clear?: unknown }
  try {
    input = JSON.parse(body.text) as typeof input
  } catch {
    return json(400, { code: 'malformed' })
  }
  if (!input || typeof input !== 'object' || !isSecretId(input.id)) return json(400, { code: 'unknown_secret' })
  const id = input.id
  if (input.clear === true) {
    const result = await writeSecret(req.payload, id, null)
    req.payload.logger.info(`integrations: secret cleared id=${id} by=${guard.actor.id}`)
    return json(200, result)
  }
  const check = validateSecretInput(id, input.value)
  if (check !== 'ok') return json(400, { code: check })
  try {
    const result = await writeSecret(req.payload, id, String(input.value))
    if (result.code !== 'ok') return json(409, { code: result.code })
    req.payload.logger.info(`integrations: secret updated id=${id} by=${guard.actor.id}`)
    return json(200, result)
  } catch {
    req.payload.logger.error(`integrations: secret write failed id=${id}`)
    return json(500, { code: 'internal' })
  }
}

type Limiter = ReturnType<typeof createRateLimiter>
const store = globalThis as typeof globalThis & { softmarketTestEmailLimits?: { minute: Limiter; hour: Limiter } }
/** Test e-mails: 1 per minute and 5 per hour per admin (process-local). */
const limits = (store.softmarketTestEmailLimits ??= { minute: createRateLimiter(1, 60_000), hour: createRateLimiter(5, 60 * 60_000) })

export async function handleTestEmail(req: PayloadRequest, now = Date.now()): Promise<Response> {
  if (req.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  const guard = guardAdminSession(req)
  if (!guard.ok) return guard.response
  // Body is ignored: the only recipient is the signed-in admin's own address.
  await req.body?.cancel().catch(() => undefined)
  const to = (req.user as { email?: unknown } | null)?.email
  if (typeof to !== 'string' || !to.includes('@')) return json(400, { code: 'no_recipient' })
  const actor = String(guard.actor.id)
  if (!limits.minute(actor, now) || !limits.hour(actor, now)) return json(429, { code: 'rate_limited' })
  const { isEmailConfigured } = await import('@/lib/email/adapter')
  if (!(await isEmailConfigured(req.payload))) return json(409, { code: 'smtp_not_configured' })
  const en = (req as { i18n?: { language?: string } }).i18n?.language === 'en'
  const subject = en ? 'SoftMarket test e-mail' : 'SoftMarket test e-postası'
  const body = en ? 'SMTP settings work: this message was sent from the admin panel.' : 'SMTP ayarları çalışıyor: bu ileti yönetim panelinden gönderildi.'
  try {
    await req.payload.sendEmail({ to, subject, text: `${subject}\n\n${body}`, html: emailTemplate({ locale: en ? 'en' : 'tr', title: subject, body }) })
  } catch {
    req.payload.logger.warn(`integrations: test e-mail failed by=${actor}`)
    return json(502, { code: 'send_failed' })
  }
  req.payload.logger.info(`integrations: test e-mail sent by=${actor}`)
  return json(200, { code: 'sent' })
}
