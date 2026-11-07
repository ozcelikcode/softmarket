export const EXPIRY_WARNING_DAYS = 30
const DAY = 86_400_000

export type LicenseDisplayState =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'revoked'
  | 'suspended'
  | 'upcoming'

type LicenseLike = {
  status?: string | null
  startsAt?: string | Date | null
  expiresAt?: string | Date | null
}

const time = (value: string | Date | null | undefined) => {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : NaN
}

/** Customer-facing state. `expiring` = still valid, ends within 30 days. */
export function licenseState(
  license: LicenseLike,
  now: Date = new Date(),
): { state: LicenseDisplayState; daysLeft: number | null } {
  const current = now.getTime()
  if (!Number.isFinite(current)) return { state: 'expired', daysLeft: null }
  const expires = time(license.expiresAt)
  const starts = time(license.startsAt)
  const daysLeft = expires !== null && Number.isFinite(expires) ? Math.ceil((expires - current) / DAY) : null
  if (license.status === 'revoked') return { state: 'revoked', daysLeft }
  if (license.status === 'suspended') return { state: 'suspended', daysLeft }
  if (license.status === 'expired') return { state: 'expired', daysLeft }
  if (license.status !== 'active') return { state: 'revoked', daysLeft }
  if (expires !== null && (!Number.isFinite(expires) || expires <= current)) return { state: 'expired', daysLeft }
  if (starts === null || !Number.isFinite(starts) || starts > current) return { state: 'upcoming', daysLeft }
  if (expires !== null && expires - current <= EXPIRY_WARNING_DAYS * DAY) return { state: 'expiring', daysLeft }
  return { state: 'active', daysLeft }
}

/** Valid for use (downloads, support): `active` or `expiring`. */
export const isUsableState = (state: LicenseDisplayState) => state === 'active' || state === 'expiring'

/** Shows only the last group: `•••••-•••••-•••••-•••••-AB12C`. Unknown formats keep the last 4 characters. */
export function maskLicenseKey(key: string | null | undefined): string {
  if (!key) return ''
  const groups = key.split('-')
  if (/^[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}$/.test(key)) {
    return groups.map((g, i) => (i === groups.length - 1 ? g : '•'.repeat(g.length))).join('-')
  }
  return key.length <= 4 ? '•'.repeat(key.length) : '•'.repeat(key.length - 4) + key.slice(-4)
}
