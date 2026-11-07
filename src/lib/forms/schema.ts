import { z } from 'zod'

export const FORM_KINDS = ['demo', 'quote', 'contact', 'support'] as const
export type FormKind = (typeof FORM_KINDS)[number]
export const formTitle = (kind: FormKind) => `softmarket-${kind}`
export const leadSchema = z.object({
  kind: z.enum(FORM_KINDS),
  locale: z.enum(['tr', 'en']),
  name: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .refine((s) => !/[\r\n]/.test(s)),
  company: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  message: z.string().trim().min(10).max(5000),
  product: z.string().max(100),
  sku: z.string().max(64),
  consent: z.literal('on'),
  website: z.string().max(200),
  token: z.string().max(2048),
})
export function hasHoneypot(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length > 0
}
export type FormState = {
  status: 'idle' | 'success' | 'invalid' | 'rate' | 'verification' | 'error'
  errors?: Record<string, string>
}
