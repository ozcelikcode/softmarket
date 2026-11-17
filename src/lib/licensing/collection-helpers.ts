import type { CollectionConfig, Field } from 'payload'

import { isAdminUser, isPanelAdmin, nobody } from '@/access'

/*
 * Shared shape of the L1 security collections (plan permanent rule 3): server-written only, read by an admin with a
 * panel session (never an editor, customer, anonymous user or users API key), hidden from editors' navigation,
 * never in the MCP allow-list (src/lib/mcp.ts), never revalidating public pages.
 */
export const SECURITY_ACCESS = { read: isPanelAdmin, create: nobody, update: nobody, delete: nobody } satisfies CollectionConfig['access']

export const hiddenUnlessAdmin = ({ user }: { user: unknown }): boolean => !isAdminUser(user as never)

/** Every data field read-only in the admin UI (writes are denied anyway; this keeps the form honest). */
export const readOnlyFields = (fields: Field[]): Field[] =>
  fields.map((field) => ('name' in field && field.type !== 'ui' ? ({ ...field, admin: { ...field.admin, readOnly: true } } as Field) : field))

export const options = (values: readonly string[]) => values.map((value) => ({ label: value, value }))
