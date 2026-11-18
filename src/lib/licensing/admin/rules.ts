/*
 * L6b pure helpers shared by the admin action service and the license side panel (no I/O, safe to import anywhere).
 */

type LastRow = { to: string; source: string; reason: string | null; rule_key: string | null }

/**
 * Which suspension the license's latest status log row describes:
 *   `rule`   automatic rule suspension -> `restore` (L5 core: false positive + suppression);
 *   `manual` admin suspension          -> `restore` (back to the previous status, customer "re-enabled" e-mail);
 *   `other`  payment dispute, system, direct panel edit -> `reactivate`;
 *   null     the license is not suspended.
 */
export function suspensionKind(status: string, last: LastRow | null): 'rule' | 'manual' | 'other' | null {
  if (status !== 'suspended') return null
  if (!last || last.to !== 'suspended') return 'other'
  if (last.source === 'rule' && last.reason?.startsWith('rule_') && last.rule_key) return 'rule'
  if (last.source === 'admin' && last.reason === 'manual') return 'manual'
  return 'other'
}

/** The typed confirmation for a revocation: the last 6 characters of the license public ID (case-insensitive). */
export const revokeConfirmation = (publicId: string | null | undefined): string =>
  typeof publicId === 'string' && publicId.length >= 6 ? publicId.slice(-6).toLowerCase() : ''
