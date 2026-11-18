import { sql } from '@payloadcms/db-sqlite'

import { isLicenseValid } from '@/lib/licenses/validity'
import type { PaymentTx } from '@/lib/payments/store/transaction'
import { unixSeconds, type ErrorCode } from './respond'

export type LicenseEligibility = {
  status: string; startsAt: string | null; expiresAt: string | null; enabled: number; verified: number
}

export const licenseTables = sql`licenses l JOIN products p ON p.id = l.product_id
  JOIN customers c ON c.id = l.customer_id JOIN editions e ON e.id = l.edition_id AND e.product_id = p.id`
export const eligibilityFields = sql`l.status, l.starts_at AS startsAt, l.expires_at AS expiresAt,
  p.licensing_enabled AS enabled, c._verified AS verified`

export async function apiAvailable(db: Pick<PaymentTx, 'all'>, kid: string): Promise<boolean> {
  const [available] = await db.all(sql`SELECT 1 FROM licensing_settings s
    JOIN licensing_settings_signing_keys k ON k._parent_id = s.id
    WHERE s.api_enabled = 1 AND k.kid = ${kid} AND k.retired_at IS NULL AND k.revoked_at IS NULL`)
  return Boolean(available)
}

export function licenseError(license: LicenseEligibility, now: Date): ErrorCode | null {
  if (license.status === 'suspended') return 'license_suspended'
  if (license.status === 'revoked') return 'license_revoked'
  if (license.status === 'expired') return 'license_expired'
  if (isLicenseValid(license, now)
    && (!license.expiresAt || Math.floor(Date.parse(license.expiresAt) / 1000) > unixSeconds(now))) return null
  if (!license.startsAt || !(Date.parse(license.startsAt) <= now.getTime())) return 'license_not_started'
  return license.status === 'active' ? 'license_expired' : 'internal'
}

export function entitlementError(license: LicenseEligibility, deviceStatus: string, now: Date): ErrorCode | null {
  if (license.enabled !== 1 || license.verified !== 1) return 'invalid_license'
  return licenseError(license, now) ?? (deviceStatus === 'active' ? null : 'activation_revoked')
}
