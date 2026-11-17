import type { CollectionConfig } from 'payload'

import { SECURITY_BLOCK_KINDS, SECURITY_BLOCK_SCOPES, SECURITY_BLOCK_SOURCES } from '@/lib/licensing/constants'
import { SECURITY_ACCESS, hiddenUnlessAdmin, options, readOnlyFields } from '@/lib/licensing/collection-helpers'

/*
 * L1 security-blocks (plan §4.5): block list for the licensing API/portal. For IPs only a prefix/CIDR is stored, never a
 * full address. Rule blocks always expire; only an admin may add a block without `expiresAt`. Added/lifted only through
 * admin endpoints or the rule engine (L5/L6, overrideAccess); read = admin panel session only.
 */
export const SecurityBlocks: CollectionConfig = {
  slug: 'security-blocks',
  admin: {
    useAsTitle: 'value',
    defaultColumns: ['kind', 'value', 'scope', 'active', 'expiresAt', 'source'],
    group: 'Security',
    hidden: hiddenUnlessAdmin,
  },
  defaultSort: '-createdAt',
  disableDuplicate: true,
  access: SECURITY_ACCESS,
  // Not exposed through GraphQL at all (no use case; smaller surface). REST stays for the admin panel.
  graphQL: false,
  lockDocuments: false,
  fields: readOnlyFields([
    { name: 'kind', type: 'select', required: true, index: true, options: options(SECURITY_BLOCK_KINDS) },
    { name: 'value', type: 'text', required: true, index: true, maxLength: 128 },
    { name: 'scope', type: 'select', required: true, defaultValue: 'api', options: options(SECURITY_BLOCK_SCOPES) },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true },
    { name: 'expiresAt', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'source', type: 'select', required: true, options: options(SECURITY_BLOCK_SOURCES) },
    { name: 'reason', type: 'text', maxLength: 500 },
    { name: 'event', type: 'relationship', relationTo: 'security-events' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
    { name: 'liftedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'liftedBy', type: 'relationship', relationTo: 'users' },
    { name: 'liftReason', type: 'text', maxLength: 500 },
  ]),
}
