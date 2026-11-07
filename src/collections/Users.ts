import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import {
  USER_ROLES,
  canAccessAdminPanel,
  isAdmin,
  isAdminField,
  isAdminOrEditor,
  isAdminOrSelfUser,
} from '@/access'

/** First user ever created becomes admin (bootstrap via /admin/create-first-user). */
const bootstrapFirstAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', overrideAccess: true, req })
  if (totalDocs === 0) return { ...data, roles: ['admin'] }
  return data
}

/** Revoke API authentication on role downgrade; editors cannot own API credentials. */
export const adminAPIKeysOnly: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!(data?.roles ?? originalDoc?.roles ?? []).includes('admin')) {
    return { ...data, enableAPIKey: false, apiKey: null, apiKeyIndex: null }
  }
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'roles'],
    group: 'Admin',
  },
  auth: {
    useAPIKey: true,
    tokenExpiration: 60 * 60 * 8,
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
  },
  access: {
    admin: canAccessAdminPanel,
    read: isAdminOrEditor,
    create: isAdmin,
    update: isAdminOrSelfUser,
    delete: isAdmin,
    unlock: isAdmin,
  },
  hooks: {
    beforeChange: [bootstrapFirstAdmin],
    beforeValidate: [adminAPIKeysOnly],
  },
  fields: [
    // Merge into Payload's built-in fields, retaining its encryption/index hooks.
    { name: 'enableAPIKey', type: 'checkbox', access: { read: isAdminField, create: isAdminField, update: isAdminField } },
    { name: 'apiKey', type: 'text', access: { read: isAdminField, create: isAdminField, update: isAdminField } },
    { name: 'apiKeyIndex', type: 'text', hidden: true, access: { read: isAdminField, create: isAdminField, update: isAdminField } },
    // Email added by default
    { name: 'name', type: 'text' },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['editor'],
      saveToJWT: true,
      options: USER_ROLES.map((role) => ({ label: role, value: role })),
      access: {
        create: isAdminField,
        update: isAdminField,
      },
    },
  ],
}
