import type { CollectionConfig } from 'payload'

import {
  SECURITY_AUDIT_ACTIONS,
  SECURITY_AUDIT_ACTOR_KINDS,
  SECURITY_AUDIT_RESULTS,
  SECURITY_AUDIT_TARGETS,
} from '@/lib/licensing/constants'
import { SECURITY_ACCESS, hiddenUnlessAdmin, options, readOnlyFields } from '@/lib/licensing/collection-helpers'

/*
 * L1 security-audit (plan §4.7): admin and system security actions (suspend/revoke/restore, blocks, triage, settings,
 * signing key rotation). Written only by server code; reason required by the L6 endpoints. `nonce` is unique so a
 * state-changing licensing API request can be recorded once (plan T4). Retention 2 years.
 */
export const SecurityAudit: CollectionConfig = {
  slug: 'security-audit',
  admin: {
    useAsTitle: 'action',
    defaultColumns: ['action', 'actorUser', 'actorKind', 'result', 'at'],
    group: 'Security',
    hidden: hiddenUnlessAdmin,
  },
  defaultSort: '-at',
  disableDuplicate: true,
  access: SECURITY_ACCESS,
  // Not exposed through GraphQL at all (no use case; smaller surface). REST stays for the admin panel.
  graphQL: false,
  lockDocuments: false,
  fields: readOnlyFields([
    { name: 'action', type: 'select', required: true, index: true, options: options(SECURITY_AUDIT_ACTIONS) },
    { name: 'actorUser', type: 'relationship', relationTo: 'users', index: true },
    { name: 'actorKind', type: 'select', required: true, options: options(SECURITY_AUDIT_ACTOR_KINDS) },
    { name: 'target', type: 'relationship', relationTo: [...SECURITY_AUDIT_TARGETS] },
    { name: 'reason', type: 'text', maxLength: 500 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'at', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'ipPrefix', type: 'text' },
    { name: 'result', type: 'select', required: true, options: options(SECURITY_AUDIT_RESULTS) },
    { name: 'nonce', type: 'text', unique: true },
  ]),
}
