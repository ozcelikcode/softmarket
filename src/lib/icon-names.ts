/** Curated lucide icon ids editors may pick (admin select + renderer map share this list). */
export const ICON_NAMES = [
  'boxes', 'cloud', 'cpu', 'database', 'film', 'gauge', 'globe', 'layers', 'life-buoy', 'lock', 'network',
  'package', 'shield', 'shield-check', 'sparkles', 'workflow', 'zap',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/** `ShieldCheck` / ` shield-check ` -> `shield-check`; unknown names -> null. */
export function normalizeIconName(name: unknown): IconName | null {
  if (typeof name !== 'string') return null
  const id = name.trim().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
  return (ICON_NAMES as readonly string[]).includes(id) ? (id as IconName) : null
}
