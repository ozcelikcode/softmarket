/*
 * L1 licensing core: stored enum values and code-level limits (docs/plan-licensing-security.md §4, §5.1, §6).
 * Single source for collection select options, the licensing-settings global and later phases (L2-L6).
 * Values are stored as plain text in SQLite: adding a value later needs no migration, renaming one does.
 */
import { LICENSE_STATUSES } from '@/lib/licenses/validity'

export { LICENSE_STATUSES }

/** Rules that the L5 engine may evaluate. Automatic actions never go beyond `suspend` (revoke needs an admin). */
export const LICENSING_RULE_KEYS = [
  'ipSpread',
  'geoSpread',
  'impossibleTravel',
  'activationBurst',
  'activationChurn',
  'cloneSuspected',
] as const
export type LicensingRuleKey = (typeof LICENSING_RULE_KEYS)[number]

/** Rule modes. There is deliberately no `revoke` mode. */
export const RULE_MODES = ['off', 'observe', 'notify', 'suspend'] as const
export type RuleMode = (typeof RULE_MODES)[number]

/** `rule_<snake_case rule key>`, one per LICENSING_RULE_KEYS entry (same order; tested). */
export const RULE_STATUS_REASONS = [
  'rule_ip_spread',
  'rule_geo_spread',
  'rule_impossible_travel',
  'rule_activation_burst',
  'rule_activation_churn',
  'rule_clone_suspected',
] as const

/** Why the license status last changed (`licenses.statusReason`, `license-status-log.reason`). */
export const LICENSE_STATUS_REASONS = ['manual', 'payment_refund', 'payment_dispute', ...RULE_STATUS_REASONS, 'expiry', 'restore'] as const
export type LicenseStatusReason = (typeof LICENSE_STATUS_REASONS)[number]

/** Who changed the license status (`licenses.statusSource`). */
export const LICENSE_STATUS_SOURCES = ['admin', 'mcp', 'payment', 'rule', 'system', 'import'] as const
/** Transition log sources: license sources plus the customer (portal device actions, L7). */
export const TRANSITION_SOURCES = [...LICENSE_STATUS_SOURCES, 'customer'] as const
export type TransitionSource = (typeof TRANSITION_SOURCES)[number]

export const ACTIVATION_STATUSES = ['active', 'deactivated', 'revoked'] as const
export const ACTIVATION_END_REASONS = ['user', 'admin', 'customer_portal', 'rebind', 'license_revoked', 'rule'] as const
export const DEVICE_PLATFORMS = ['windows', 'macos', 'linux', 'other'] as const

/** §5.1 event catalog (types only; default severities and detail schemas arrive with the event writer, L3/L5). */
export const SECURITY_EVENT_TYPES = [
  'activation.created',
  'activation.rebind',
  'activation.ended',
  'activation.seat_limit',
  'activation.burst',
  'activation.churn',
  'activation.clone_suspected',
  'license.ip_spread',
  'license.geo_spread',
  'license.impossible_travel',
  'license.status_changed',
  'license.expired',
  'license.created_via_mcp',
  'api.invalid_license',
  'api.bad_signature',
  'api.replay',
  'api.clock_skew',
  'api.rate_limited',
  'api.blocked_request',
  'auth.admin_login_failed',
  'auth.admin_locked',
  'auth.admin_new_network',
  'auth.portal_login_failed',
  'auth.portal_locked',
  'webhook.bad_signature',
  'system.rule_circuit_open',
  'system.signing_key_rotated',
  'system.events_dropped',
] as const
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number]

export const SECURITY_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
export const SECURITY_EVENT_SOURCES = ['api', 'portal', 'admin', 'webhook', 'system', 'rule'] as const
export const SECURITY_ACTIONS_TAKEN = ['none', 'notified', 'throttled', 'blocked', 'suspended'] as const
export const SECURITY_TRIAGE_STATES = ['open', 'acknowledged', 'resolved', 'false_positive'] as const
export const SECURITY_NOTIFY_STATES = ['pending', 'sent', 'failed', 'skipped'] as const

export const SECURITY_BLOCK_KINDS = ['ip_prefix', 'cidr', 'activation', 'license', 'fingerprint'] as const
export const SECURITY_BLOCK_SCOPES = ['api', 'portal', 'all'] as const
export const SECURITY_BLOCK_SOURCES = ['admin', 'rule'] as const

/** Admin and system actions recorded in `security-audit`. Bulk actions are out of scope for v1 (plan §5.4). */
export const SECURITY_AUDIT_ACTIONS = [
  'license.suspend',
  'license.revoke',
  'license.reactivate',
  'license.restore',
  'activation.deactivate',
  'block.add',
  'block.lift',
  'event.triage',
  'settings.update',
  'signing_key.rotate',
] as const
export const SECURITY_AUDIT_ACTOR_KINDS = ['admin', 'system', 'rule'] as const
export const SECURITY_AUDIT_RESULTS = ['ok', 'denied', 'error'] as const
export const SECURITY_AUDIT_TARGETS = ['licenses', 'license-activations', 'security-blocks', 'security-events'] as const

export const COUNTRY_SOURCES = ['none', 'cloudflare_header'] as const

/** `products.licensing.code`: the lease `aud`, embedded in shipped programs. Immutable once set. */
export const LICENSING_CODE_RE = /^[a-z0-9][a-z0-9-]{2,40}$/

/** Opaque public identifiers (`lic_…`, `act_…` in the API): 12 CSPRNG bytes as lowercase hex. */
export const PUBLIC_ID_RE = /^[0-9a-f]{24}$/

/**
 * Code floors for retention settings (plan §6). The admin may raise or lower the defaults but never below these.
 * Status log keeps commercial records (10 years); audit 2 years.
 */
export const RETENTION_FLOORS = {
  eventIpDays: 7,
  eventDays: 30,
  activationIpDays: 7,
  activationRowYears: 1,
  blockDays: 7,
  statusLogYears: 10,
  auditYears: 1,
} as const

/** Hard upper bound of the offline lease (plan §1.1). */
export const MAX_LEASE_DAYS = 30
