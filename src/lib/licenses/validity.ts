export const LICENSE_STATUSES = ['active', 'suspended', 'revoked', 'expired'] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

type LicenseLike = {
  status?: LicenseStatus | string | null
  startsAt?: string | Date | null
  expiresAt?: string | Date | null
}

/** Pure validity check, mirrors `validLicenseWhere` in src/access/licenses.ts. */
export const isLicenseValid = (license: LicenseLike, now: Date = new Date()): boolean => {
  if (license.status !== 'active') return false
  const currentTime = now.getTime()
  const startsAt = license.startsAt ? new Date(license.startsAt).getTime() : NaN
  if (!Number.isFinite(currentTime) || !Number.isFinite(startsAt) || startsAt > currentTime) return false
  if (license.expiresAt) {
    const expiresAt = new Date(license.expiresAt).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= currentTime) return false
  }
  return true
}

/** Adds calendar months (clamped to month end, e.g. Jan 31 + 1 = Feb 28/29). */
export const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}
