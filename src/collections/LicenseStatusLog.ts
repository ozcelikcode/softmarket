import type { CollectionConfig } from 'payload'

import { LICENSE_STATUSES, LICENSE_STATUS_REASONS, TRANSITION_SOURCES } from '@/lib/licensing/constants'
import { SECURITY_ACCESS, hiddenUnlessAdmin, options, readOnlyFields } from '@/lib/licensing/collection-helpers'

/*
 * L1 license-status-log (plan §4.6): append-only journal of every license status transition, written in the same
 * transaction as the change by `recordLicenseTransition()` (src/lib/licensing/transitions.ts). No IPs; `note` must not
 * carry personal data. Nobody creates/updates/deletes it through any API. Retention: license lifetime + 10 years.
 */
export const LicenseStatusLog: CollectionConfig = {
  slug: 'license-status-log',
  admin: {
    useAsTitle: 'to',
    defaultColumns: ['license', 'from', 'to', 'reason', 'source', 'at'],
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
    { name: 'license', type: 'relationship', relationTo: 'licenses', required: true, index: true },
    { name: 'from', type: 'select', required: true, options: options(LICENSE_STATUSES) },
    { name: 'to', type: 'select', required: true, options: options(LICENSE_STATUSES) },
    { name: 'reason', type: 'select', options: options(LICENSE_STATUS_REASONS) },
    { name: 'source', type: 'select', required: true, options: options(TRANSITION_SOURCES) },
    { name: 'actorUser', type: 'relationship', relationTo: 'users' },
    { name: 'order', type: 'relationship', relationTo: 'orders' },
    { name: 'event', type: 'relationship', relationTo: 'security-events' },
    { name: 'ruleKey', type: 'text', maxLength: 64 },
    { name: 'note', type: 'textarea', maxLength: 500 },
    { name: 'at', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'revertOf', type: 'relationship', relationTo: 'license-status-log' },
    { name: 'revertible', type: 'checkbox', defaultValue: false },
  ]),
}
