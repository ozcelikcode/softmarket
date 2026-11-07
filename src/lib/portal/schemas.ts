import { z } from 'zod'

const locale = z.enum(['tr', 'en'])
const email = z
  .email()
  .max(254)
  .refine((s) => !/[\r\n]/.test(s))
const password = z.string().min(10).max(128)
const honeypot = z.string().max(200).optional().default('')
const token = z.string().max(2048).optional().default('')

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
  locale,
  next: z.string().max(300).optional().default(''),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email,
    company: z.string().trim().max(160).optional().default(''),
    password,
    confirm: z.string().max(128),
    consent: z.literal('on'),
    locale,
    website: honeypot,
    token,
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'] })

export const forgotSchema = z.object({ email, locale, website: honeypot, token })

export const resetSchema = z
  .object({
    resetToken: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/),
    password,
    confirm: z.string().max(128),
    locale,
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'] })

export const verifySchema = z.object({
  verifyToken: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/),
  locale,
})

/** ONLY these customer fields can be changed from the portal. Never email, role-like or system fields. */
export const PROFILE_FIELDS = ['name', 'company', 'phone', 'taxNumber'] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === '' || /^\+?[\d\s()\-.]{5,40}$/.test(v)),
  taxNumber: z
    .string()
    .trim()
    .refine((v) => v === '' || /^\d{10,11}$/.test(v)),
})

/** Builds the update payload from untrusted form data: allow-list only, nothing else is copied. */
export function pickProfileUpdate(input: Record<string, unknown>): Record<ProfileField, string> {
  const parsed = profileSchema.parse(Object.fromEntries(PROFILE_FIELDS.map((k) => [k, input[k] ?? ''])))
  return Object.fromEntries(PROFILE_FIELDS.map((k) => [k, parsed[k]])) as Record<ProfileField, string>
}

export const passwordChangeSchema = z
  .object({ current: z.string().min(1).max(128), password, confirm: z.string().max(128) })
  .refine((v) => v.password === v.confirm, { path: ['confirm'] })
  .refine((v) => v.password !== v.current, { path: ['password'] })

const numericId = z.string().regex(/^[1-9]\d{0,9}$/)

export const ticketSchema = z.object({
  subject: z.string().trim().min(5).max(200),
  product: numericId,
  body: z.string().trim().min(10).max(10000),
  locale,
})

export const replySchema = z.object({
  ticket: numericId,
  body: z.string().trim().min(2).max(10000),
  locale,
})

export type PortalFormState = {
  status:
    | 'idle'
    | 'success'
    | 'invalid'
    | 'rate'
    | 'verification'
    | 'error'
    | 'credentials'
    | 'unverified'
    | 'currentPassword'
    | 'closed'
    | 'token'
  errors?: Record<string, string>
}

export const issueFields = (error: z.ZodError): Record<string, string> =>
  Object.fromEntries(error.issues.map((i) => [String(i.path[0] ?? 'form'), 'invalid']))

export const formStrings = (data: FormData, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, data.getAll(k).length > 1 ? null : (data.get(k) ?? undefined)]))
