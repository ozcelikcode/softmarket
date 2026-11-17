import type { CollectionConfig } from 'payload'

import { ACTIVATION_END_REASONS, ACTIVATION_STATUSES, DEVICE_PLATFORMS } from '@/lib/licensing/constants'
import { SECURITY_ACCESS, hiddenUnlessAdmin, options, readOnlyFields } from '@/lib/licensing/collection-helpers'

/*
 * L1 license-activations (plan §4.3): one row per activated device (seat = active device). Written only by the
 * licensing API/portal/admin server code (L3/L6/L7, overrideAccess). Raw fingerprints, full IPs and private keys are
 * never stored: only an HMAC of the fingerprint, the device PUBLIC key + its thumbprint, a truncated IP prefix and a
 * monthly-keyed IP HMAC. Read = admin panel session only.
 *
 * Hand-written partial unique indexes in migration `licensing_core` (asserted by tests/unit/licensing-migration.test.ts):
 *   license_activations_one_active_fp    ON (license_id, fingerprint_hash) WHERE status = 'active'
 *   license_activations_one_active_thumb ON (device_key_thumbprint)        WHERE status = 'active'
 * Any later migration that rebuilds this table (`__new_license_activations`) must re-create both by hand.
 */
export const LicenseActivations: CollectionConfig = {
  slug: 'license-activations',
  admin: {
    useAsTitle: 'publicId',
    defaultColumns: ['publicId', 'license', 'status', 'deviceLabel', 'platform', 'lastSeenAt'],
    group: 'Security',
    hidden: hiddenUnlessAdmin,
  },
  defaultSort: '-activatedAt',
  disableDuplicate: true,
  access: SECURITY_ACCESS,
  // Not exposed through GraphQL at all (no use case; smaller surface). REST stays for the admin panel.
  graphQL: false,
  lockDocuments: false,
  fields: readOnlyFields([
    { name: 'publicId', type: 'text', required: true, unique: true },
    { name: 'license', type: 'relationship', relationTo: 'licenses', required: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'customers', index: true },
    { name: 'product', type: 'relationship', relationTo: 'products', index: true },
    { name: 'status', type: 'select', required: true, defaultValue: 'active', index: true, options: options(ACTIVATION_STATUSES) },
    { name: 'endReason', type: 'select', options: options(ACTIVATION_END_REASONS) },
    { name: 'devicePublicKey', type: 'text', required: true },
    { name: 'deviceKeyThumbprint', type: 'text', required: true, index: true },
    { name: 'fingerprintHash', type: 'text', required: true, index: true },
    { name: 'deviceLabel', type: 'text', maxLength: 64 },
    { name: 'platform', type: 'select', options: options(DEVICE_PLATFORMS) },
    { name: 'arch', type: 'text', maxLength: 32 },
    { name: 'appVersion', type: 'text', maxLength: 32 },
    { name: 'counter', type: 'text' },
    { name: 'prevCounter', type: 'text' },
    { name: 'activatedAt', type: 'date', required: true, index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastSeenAt', type: 'date', index: true, admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'endedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'lastIpPrefix', type: 'text' },
    { name: 'lastIpHash', type: 'text' },
    { name: 'lastCountry', type: 'text', maxLength: 2 },
    { name: 'endNonce', type: 'text' },
  ]),
}
