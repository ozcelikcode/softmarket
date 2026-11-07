import { Forbidden, type CollectionConfig } from 'payload'

import { isAdmin, isAdminField, isAdminOrEditorUser, isStaffOrSelfCustomer } from '@/access'
import {
  resetEmailHTML,
  resetEmailSubject,
  verifyEmailHTML,
  verifyEmailSubject,
} from '@/lib/portal/email'
import { portalCookieStrategy } from '@/lib/portal/strategy'
import { KVKK_CONSENT_VERSION } from '@/lib/portal/policy'
import { PROFILE_FIELDS } from '@/lib/portal/schemas'

/** Portal customers. Separate auth collection; never allowed into the admin panel. */
export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'company', 'taxNumber'],
    group: 'Customers',
  },
  auth: {
    // Portal links (not Payload's admin/REST defaults) in the e-mails, localised by preferredLocale.
    verify: { generateEmailSubject: verifyEmailSubject, generateEmailHTML: verifyEmailHTML },
    forgotPassword: { generateEmailSubject: resetEmailSubject, generateEmailHTML: resetEmailHTML },
    // Portal session cookie is separate from Payload's `payload-token` (admin users).
    strategies: [portalCookieStrategy],
    useSessions: true,
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 10,
    lockTime: 15 * 60 * 1000,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  access: {
    admin: () => false,
    // Self-registration is mediated by the validated portal action (Turnstile + KVKK).
    create: ({ req }) => isAdminOrEditorUser(req.user) || (!req.user && req.context?.portalRegistration === true),
    read: isStaffOrSelfCustomer,
    update: isStaffOrSelfCustomer,
    delete: isAdmin,
    unlock: isAdmin,
  },
  hooks: {
    beforeOperation: [({ args, operation, req }) => {
      // Raw REST/GraphQL auth endpoints would bypass portal rate limits, Turnstile and uniform replies.
      if (req.payloadAPI !== 'local' && ['login', 'forgotPassword', 'resetPassword'].includes(operation)) {
        throw new Forbidden(req.t)
      }
      if (operation === 'update' && req.user?.collection === 'customers' && 'data' in args && args.data) {
        const allowed = new Set<string>(PROFILE_FIELDS)
        if (req.context.portalPasswordChange === true) allowed.add('password')
        if (Object.keys(args.data).some((key) => !allowed.has(key))) throw new Forbidden(req.t)
      }
      return args
    }],
    beforeValidate: [({ data, operation, originalDoc, req }) => {
      if (!data) return data
      if (operation === 'create' && req.context.portalRegistration === true) {
        data.kvkkConsentAt = new Date().toISOString()
        data.kvkkConsentVersion = KVKK_CONSENT_VERSION
      }
      // Runs after field access filtering, before the same DB write as the credentials.
      // resetPassword passes the newly hashed user through this hook, without `password`.
      if (operation === 'update' && (data.password || (!originalDoc && data.hash && data.salt))) data.sessions = []
      return data
    }],
  },
  fields: [
    { name: 'email', type: 'email', required: true, access: { update: ({ req }) => isAdminOrEditorUser(req.user) } },
    { name: '_verified', type: 'checkbox', access: { create: isAdminField, update: isAdminField } },
    { name: 'name', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'company', type: 'text' },
        { name: 'phone', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'taxNumber',
          type: 'text',
          label: 'Tax No / TCKN',
          validate: (value: string | null | undefined) =>
            !value || /^\d{10,11}$/.test(value) ? true : 'Vergi no 10, TCKN 11 haneli olmalı.',
        },
        { name: 'taxOffice', type: 'text' },
      ],
    },
    {
      name: 'preferredLocale',
      type: 'select',
      defaultValue: 'tr',
      options: [
        { label: 'Türkçe', value: 'tr' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'kvkkConsentAt',
      type: 'date',
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'kvkkConsentVersion',
      type: 'text',
      admin: { readOnly: true },
      access: { create: () => false, update: () => false },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Internal staff notes. Not visible to the customer.' },
      access: {
        read: ({ req: { user } }) => Boolean(user && user.collection === 'users'),
        create: isAdminField,
        update: isAdminField,
      },
    },
  ],
}
