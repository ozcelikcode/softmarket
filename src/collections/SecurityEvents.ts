import type { CollectionConfig } from 'payload'

import {
  SECURITY_ACTIONS_TAKEN,
  SECURITY_EVENT_SOURCES,
  SECURITY_EVENT_TYPES,
  SECURITY_NOTIFY_STATES,
  SECURITY_SEVERITIES,
  SECURITY_TRIAGE_STATES,
} from '@/lib/licensing/constants'
import { adminAction } from '@/lib/licensing/admin/routes'
import { SECURITY_ACCESS, hiddenUnlessAdmin, options, readOnlyFields } from '@/lib/licensing/collection-helpers'

/*
 * L1 security-events (plan §4.4): aggregated security signals. Append/aggregate by `dedupeKey` (unique) from server
 * code only; triage changes only through admin endpoints (L6) that also write security-audit. `detail` holds an
 * allow-listed, PII-free object (schema per type arrives with the event writer); IP fields are a truncated prefix and
 * an HMAC, cleared after the retention period. Read = admin panel session only.
 */
export const SecurityEvents: CollectionConfig = {
  slug: 'security-events',
  admin: {
    useAsTitle: 'dedupeKey',
    defaultColumns: ['type', 'severity', 'count', 'triage', 'lastSeenAt'],
    group: 'Security',
    hidden: hiddenUnlessAdmin,
  },
  defaultSort: '-lastSeenAt',
  disableDuplicate: true,
  access: SECURITY_ACCESS,
  // Not exposed through GraphQL at all (no use case; smaller surface). REST stays for the admin panel.
  graphQL: false,
  lockDocuments: false,
  // L6b triage and "block from this event" (admin panel session only).
  endpoints: [
    adminAction('/:id/acknowledge', 'event.acknowledge'),
    adminAction('/:id/resolve', 'event.resolve'),
    adminAction('/:id/false-positive', 'event.false-positive'),
    adminAction('/:id/block', 'event.block'),
  ],
  fields: readOnlyFields([
    { name: 'type', type: 'select', required: true, index: true, options: options(SECURITY_EVENT_TYPES) },
    { name: 'severity', type: 'select', required: true, index: true, options: options(SECURITY_SEVERITIES) },
    { name: 'source', type: 'select', required: true, options: options(SECURITY_EVENT_SOURCES) },
    { name: 'firstSeenAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastSeenAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'count', type: 'number', required: true, defaultValue: 1, min: 1 },
    { name: 'dedupeKey', type: 'text', required: true, unique: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses', index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true },
    { name: 'activation', type: 'relationship', relationTo: 'license-activations', index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true },
    { name: 'actorUser', type: 'relationship', relationTo: 'users', index: true },
    { name: 'ipPrefix', type: 'text' },
    { name: 'ipHash', type: 'text' },
    { name: 'country', type: 'text', maxLength: 2 },
    { name: 'detail', type: 'json' },
    { name: 'ruleKey', type: 'text' },
    { name: 'actionTaken', type: 'select', defaultValue: 'none', options: options(SECURITY_ACTIONS_TAKEN) },
    { name: 'triage', type: 'select', required: true, defaultValue: 'open', index: true, options: options(SECURITY_TRIAGE_STATES) },
    { name: 'triagedBy', type: 'relationship', relationTo: 'users' },
    { name: 'triagedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'triageNote', type: 'textarea', maxLength: 500 },
    { name: 'notifyState', type: 'select', index: true, options: options(SECURITY_NOTIFY_STATES) },
    { name: 'notifyAttempts', type: 'number', defaultValue: 0, min: 0 },
    { name: 'notifyNextAt', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'notifyLastError', type: 'text', maxLength: 200 },
  ]),
}
