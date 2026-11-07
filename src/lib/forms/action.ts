'use server'

import { headers } from 'next/headers'
import { getPayloadClient } from '@/lib/site'
import { getContactSettings } from '@/lib/content'
import { getSupportProducts, getSupportEditions } from '@/lib/support'
import { quoteSelection } from '@/lib/support-query'
import { siteUrl } from '@/lib/seo'
import { getLeadForm } from './data'
import { hasHoneypot, leadSchema, type FormState } from './schema'
import { allowSubmission, requestIP, verifyTurnstile } from './security'

export async function submitLead(_previous: FormState, data: FormData): Promise<FormState> {
  const h = await headers()
  // Validate the request host, not the canonical SEO URL (local aliases may differ).
  const origin = h.get('origin')
  let hostname = new URL(siteUrl()).hostname
  if (!origin) return { status: 'error' }
  try {
    const url = new URL(origin)
    const host = h.get('host')
    if (!['http:', 'https:'].includes(url.protocol) || !host || url.host !== host)
      return { status: 'error' }
    hostname = url.hostname
  } catch {
    return { status: 'error' }
  }
  const ip = requestIP(h)
  if (!allowSubmission(ip)) return { status: 'rate' }
  if (hasHoneypot(data.get('website') ?? '')) return { status: 'success' }
  const fields = [
    'kind',
    'locale',
    'name',
    'email',
    'company',
    'phone',
    'message',
    'product',
    'sku',
    'consent',
    'website',
  ]
  const raw = Object.fromEntries(
    fields.map((key) => [key, data.getAll(key).length > 1 ? null : (data.get(key) ?? '')]),
  )
  raw.token = data.get('cf-turnstile-response') ?? ''
  const parsed = leadSchema.safeParse(raw)
  if (!parsed.success)
    return {
      status: 'invalid',
      errors: Object.fromEntries(parsed.error.issues.map((e) => [String(e.path[0]), 'invalid'])),
    }
  const input = parsed.data
  if (!(await verifyTurnstile(input.token, ip, { hostname }))) return { status: 'verification' }
  try {
    const [form, products, editions] = await Promise.all([
      getLeadForm(input.kind, input.locale),
      getSupportProducts(input.locale),
      getSupportEditions(input.locale),
    ])
    if (!form) return { status: 'error' }
    const selected = quoteSelection(products, editions, input.product, input.sku)
    const submissionData = Object.entries({
      name: input.name,
      email: input.email,
      company: input.company,
      phone: input.phone,
      message: input.message,
      product: selected.product,
      sku: selected.sku,
      consent: 'true',
      locale: input.locale,
    }).map(([field, value]) => ({ field, value }))
    const payload = await getPayloadClient()
    const submission = await payload.create({
      collection: 'form-submissions',
      overrideAccess: true,
      locale: input.locale,
      depth: 0,
      data: { form: form.id, submissionData },
    })
    // Persist first. Email failure never changes a successful submission into an error.
    try {
      const settings = await getContactSettings(input.locale)
      const to =
        process.env.FORM_NOTIFICATION_EMAIL ||
        (input.kind === 'support'
          ? settings?.contact?.supportEmail
          : settings?.contact?.salesEmail) ||
        settings?.contact?.email
      const text = `Submission #${submission.id}\n${submissionData.map((row) => `${row.field}: ${row.value}`).join('\n')}`
      if (to && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to) && !to.startsWith('CHANGE_')) {
        await payload.sendEmail({ to, subject: `SoftMarket: ${input.kind} request`, text })
      } else {
        payload.logger.info({
          msg: `Form notification (configure FORM_NOTIFICATION_EMAIL):\n${text}`,
        })
      }
    } catch {
      payload.logger.error('Form notification failed; submission retained.')
    }
    return { status: 'success' }
  } catch {
    return { status: 'error' }
  }
}
