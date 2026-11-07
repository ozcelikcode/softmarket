'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { commitTransaction, createLocalReq, initTransaction, killTransaction, UnverifiedEmail, ValidationError } from 'payload'

import { localizedHref } from '@/i18n/paths'
import { verifyTurnstile } from '@/lib/forms/security'
import { hasHoneypot } from '@/lib/forms/schema'
import { getMyLicenseKey, getMyLicenses, usableProducts } from '@/lib/portal/data'
import { getPayloadClient } from '@/lib/site'
import type { Customer } from '@/payload-types'

import { authResponse, dummyPasswordCheck, queueAuthEmail } from './auth-work'
import { allowAuthAttempt, allowCustomerAction, requestIP, sameOrigin } from './guard'
import { sanitizeNext } from './redirect'
import {
  forgotSchema,
  formStrings,
  issueFields,
  loginSchema,
  passwordChangeSchema,
  pickProfileUpdate,
  PROFILE_FIELDS,
  profileSchema,
  registerSchema,
  replySchema,
  resetSchema,
  ticketSchema,
  verifySchema,
  type PortalFormState,
} from './schemas'
import { clearSession, endSession, getCustomer, setSession } from './session'

type State = PortalFormState
const localeOf = (data: FormData) => (data.get('locale') === 'en' ? 'en' : 'tr')
const go = (path: string, locale: string): never => redirect(localizedHref(path, locale))

/* ------------------------------------------------------------------ auth */

export async function loginAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const parsed = loginSchema.safeParse(formStrings(data, ['email', 'password', 'locale', 'next']))
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  const { email, password, locale, next } = parsed.data
  if (!allowAuthAttempt(h, email, 'login')) return { status: 'rate' }
  let result
  try {
    result = await authResponse(async () => {
      const payload = await getPayloadClient()
      const account = await payload.db.findOne<Customer>({ collection: 'customers', where: { email: { equals: email.trim().toLowerCase() } } })
      if (!account || (account.lockUntil && new Date(account.lockUntil).getTime() > Date.now())) {
        await dummyPasswordCheck(password)
      }
      return payload.login({ collection: 'customers', data: { email, password }, depth: 0 })
    })
  } catch (error) {
    // UnverifiedEmail is only thrown after the password matched, so it reveals nothing to a guesser.
    if (error instanceof UnverifiedEmail) return { status: 'unverified' }
    return { status: 'credentials' }
  }
  if (!result.token || result.user?.collection !== 'customers') return { status: 'credentials' }
  await setSession(result.token, result.exp)
  return go(sanitizeNext(next), locale)
}

export async function registerAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  const origin = sameOrigin(h)
  if (!origin.ok) return { status: 'error' }
  if (hasHoneypot(data.get('website') ?? '')) return { status: 'success' }
  const raw = formStrings(data, ['name', 'email', 'company', 'password', 'confirm', 'consent', 'locale', 'website'])
  raw.token = data.get('cf-turnstile-response') ?? ''
  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  const input = parsed.data
  if (!allowAuthAttempt(h, input.email, 'register', 5)) return { status: 'rate' }
  if (!(await verifyTurnstile(input.token, requestIP(h), { hostname: origin.hostname }))) return { status: 'verification' }
  return authResponse(async () => {
    try {
      const payload = await getPayloadClient()
      const customer = await payload.create({
        collection: 'customers',
        context: { portalRegistration: true },
        disableVerificationEmail: true,
        showHiddenFields: true,
        user: null,
        overrideAccess: false,
        depth: 0,
        data: {
          email: input.email,
          password: input.password,
          name: input.name,
          company: input.company || undefined,
          preferredLocale: input.locale,
          marketingConsent: false,
        },
      })
      if (customer._verificationToken) queueAuthEmail(payload, customer, customer._verificationToken, 'verify')
    } catch (error) {
      // Duplicate address: answer exactly like success so the form cannot probe for accounts.
      const duplicate = error instanceof ValidationError && error.data?.errors?.some((e) => e.path === 'email')
      if (!duplicate) return { status: 'error' }
      // Duplicate registration stops before Payload hashes a password; match the new-account work.
      await dummyPasswordCheck(input.password)
    }
    return { status: 'success' }
  })
}

export async function forgotPasswordAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  const origin = sameOrigin(h)
  if (!origin.ok) return { status: 'error' }
  if (hasHoneypot(data.get('website') ?? '')) return { status: 'success' }
  const raw = formStrings(data, ['email', 'locale', 'website'])
  raw.token = data.get('cf-turnstile-response') ?? ''
  const parsed = forgotSchema.safeParse(raw)
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  if (!allowAuthAttempt(h, parsed.data.email, 'forgot', 5)) return { status: 'rate' }
  if (!(await verifyTurnstile(parsed.data.token, requestIP(h), { hostname: origin.hostname }))) return { status: 'verification' }
  return authResponse(async () => {
    try {
      const payload = await getPayloadClient()
      const token = await payload.forgotPassword({
        collection: 'customers',
        data: { email: parsed.data.email },
        disableEmail: true,
      })
      if (token) {
        const { docs } = await payload.find({ collection: 'customers', where: { email: { equals: parsed.data.email.trim().toLowerCase() } }, depth: 0, limit: 1 })
        if (docs[0]) queueAuthEmail(payload, docs[0], token, 'reset')
      }
    } catch {
      // Same answer whether or not the account exists (or mail delivery failed).
    }
    return { status: 'success' }
  })
}

export async function resetPasswordAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const parsed = resetSchema.safeParse(formStrings(data, ['resetToken', 'password', 'confirm', 'locale']))
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  if (!allowAuthAttempt(h, parsed.data.resetToken.slice(0, 16), 'reset', 10)) return { status: 'rate' }
  try {
    await (await getPayloadClient()).resetPassword({
      collection: 'customers',
      data: { token: parsed.data.resetToken, password: parsed.data.password },
      overrideAccess: true,
    })
  } catch {
    return { status: 'token' }
  }
  await clearSession()
  return redirect(`${localizedHref('/hesap/giris', parsed.data.locale)}?reset=1`)
}

export async function verifyEmailAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const parsed = verifySchema.safeParse(formStrings(data, ['verifyToken', 'locale']))
  if (!parsed.success) return { status: 'token' }
  if (!allowAuthAttempt(h, parsed.data.verifyToken.slice(0, 16), 'verify', 10)) return { status: 'rate' }
  try {
    await (await getPayloadClient()).verifyEmail({ collection: 'customers', token: parsed.data.verifyToken })
  } catch {
    return { status: 'token' }
  }
  return redirect(`${localizedHref('/hesap/giris', parsed.data.locale)}?verified=1`)
}

export async function logoutAction(data: FormData): Promise<void> {
  const h = await headers()
  const locale = localeOf(data)
  if (sameOrigin(h).ok) await endSession()
  go('/hesap/giris', locale)
}

/* --------------------------------------------------------------- profile */

export async function updateProfileAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const customer = await getCustomer()
  if (!customer) return { status: 'error' }
  if (!allowCustomerAction(customer.id, 'profile')) return { status: 'rate' }
  const raw = Object.fromEntries(PROFILE_FIELDS.map((k) => [k, data.get(k) ?? '']))
  const checked = profileSchema.safeParse(raw)
  if (!checked.success) return { status: 'invalid', errors: issueFields(checked.error) }
  const update = pickProfileUpdate(checked.data)
  try {
    await (await getPayloadClient()).update({
      collection: 'customers',
      id: customer.id,
      user: customer,
      overrideAccess: false,
      depth: 0,
      data: update,
      select: { name: true },
    })
  } catch {
    return { status: 'error' }
  }
  revalidatePath('/', 'layout')
  return { status: 'success' }
}

export async function changePasswordAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const customer = await getCustomer()
  if (!customer) return { status: 'error' }
  const parsed = passwordChangeSchema.safeParse(formStrings(data, ['current', 'password', 'confirm']))
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  if (!allowAuthAttempt(h, `pw-${customer.id}`, 'password', 5)) return { status: 'rate' }
  const payload = await getPayloadClient()
  try {
    // Proves knowledge of the current password (also counts toward Payload's account lockout).
    await payload.login({ collection: 'customers', data: { email: customer.email, password: parsed.data.current }, depth: 0 })
  } catch {
    return { status: 'currentPassword' }
  }
  try {
    await payload.update({
      collection: 'customers',
      context: { portalPasswordChange: true },
      id: customer.id,
      user: customer,
      overrideAccess: false,
      depth: 0,
      data: { password: parsed.data.password },
      select: { email: true },
    })
    // The Customers hook revokes every old session in the same write as the password.
    const again = await payload.login({ collection: 'customers', data: { email: customer.email, password: parsed.data.password }, depth: 0 })
    if (again.token) await setSession(again.token, again.exp)
  } catch {
    return { status: 'error' }
  }
  return { status: 'success' }
}

/* ---------------------------------------------------------------- tickets */

export async function createTicketAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const customer = await getCustomer()
  if (!customer) return { status: 'error' }
  const parsed = ticketSchema.safeParse(formStrings(data, ['subject', 'product', 'body', 'locale']))
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  const { subject, body, locale } = parsed.data
  const product = Number(parsed.data.product)
  if (!allowCustomerAction(customer.id, 'ticket', 10)) return { status: 'rate' }
  // Only products with a currently usable license may be chosen.
  const licensed = usableProducts(await getMyLicenses(customer, locale))
  if (!licensed.some((p) => p.id === product)) return { status: 'invalid', errors: { product: 'invalid' } }
  const payload = await getPayloadClient()
  const req = await createLocalReq({ user: customer }, payload)
  let id: number
  try {
    await initTransaction(req)
    const ticket = await payload.create({
      collection: 'support-tickets',
      req,
      user: customer,
      overrideAccess: false,
      depth: 0,
      data: { subject, product, customer: customer.id, status: 'open', priority: 'normal' },
      select: { subject: true },
    })
    id = ticket.id
    await payload.create({
      collection: 'support-ticket-messages',
      req,
      user: customer,
      overrideAccess: false,
      depth: 0,
      data: { ticket: id, body, author: 'customer' },
      select: { body: true },
    })
    // Customers cannot update tickets; only this server-owned timestamp is written after ownership is proven.
    await payload.update({
      collection: 'support-tickets',
      req: { ...req, user: null },
      id,
      overrideAccess: true,
      depth: 0,
      data: { lastMessageAt: new Date().toISOString() },
      select: { lastMessageAt: true },
    })
    await commitTransaction(req)
  } catch {
    await killTransaction(req)
    return { status: 'error' }
  }
  return go(`/hesap/talepler/${id}`, locale)
}

export async function replyTicketAction(_prev: State, data: FormData): Promise<State> {
  const h = await headers()
  if (!sameOrigin(h).ok) return { status: 'error' }
  const customer = await getCustomer()
  if (!customer) return { status: 'error' }
  const parsed = replySchema.safeParse(formStrings(data, ['ticket', 'body', 'locale']))
  if (!parsed.success) return { status: 'invalid', errors: issueFields(parsed.error) }
  if (!allowCustomerAction(customer.id, 'reply', 20)) return { status: 'rate' }
  const id = Number(parsed.data.ticket)
  const payload = await getPayloadClient()
  const req = await createLocalReq({ user: customer }, payload)
  try {
    await initTransaction(req)
    const ticket = await payload.findByID({
      collection: 'support-tickets',
      req,
      id,
      user: customer,
      overrideAccess: false,
      depth: 0,
      select: { status: true, customer: true },
    })
    if (ticket.status === 'closed') {
      await killTransaction(req)
      return { status: 'closed' }
    }
    await payload.create({
      collection: 'support-ticket-messages',
      req,
      user: customer,
      overrideAccess: false,
      depth: 0,
      data: { ticket: id, body: parsed.data.body, author: 'customer' },
      select: { body: true },
    })
    await payload.update({
      collection: 'support-tickets',
      req: { ...req, user: null },
      id,
      overrideAccess: true,
      depth: 0,
      data: {
        lastMessageAt: new Date().toISOString(),
        ...(ticket.status === 'pending' || ticket.status === 'resolved' ? { status: 'open' as const } : {}),
      },
      select: { status: true },
    })
    await commitTransaction(req)
  } catch {
    await killTransaction(req)
    return { status: 'error' }
  }
  return go(`/hesap/talepler/${id}`, parsed.data.locale)
}

/* ------------------------------------------------------------ license key */

/** Returns the full key only to its owner, on an explicit click; never rendered into the page. */
export async function revealLicenseKeyAction(id: number): Promise<{ key: string | null }> {
  const h = await headers()
  if (!sameOrigin(h).ok || !Number.isInteger(id) || id < 1) return { key: null }
  const customer = await getCustomer()
  if (!customer || !allowCustomerAction(customer.id, 'reveal', 60)) return { key: null }
  return { key: await getMyLicenseKey(customer, id) }
}
