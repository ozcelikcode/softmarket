import type { RuleMode } from '../constants'

/*
 * What happens with a rule hit (plan §5.3). Pure; the sweep re-reads every input inside the BEGIN IMMEDIATE
 * transaction that acts on it, and the L1 transition hook (transitions.ts stampLicenseTransition) re-checks mode and
 * observation window on the write itself, so this function can only make the system MORE conservative.
 *
 *   off        nothing
 *   suppressed nothing (an admin marked this rule a false positive for this license within suppressDays)
 *   observe    event only, no e-mail
 *   notify     event + admin e-mail
 *   suspend    event + automatic suspension + admin and customer e-mail, ONLY when
 *              - the observation window is over (`rules.observeUntil` set, canonical ISO and in the past),
 *              - automatic suspensions are not disabled (`maxAutoSuspendsPerHour` > 0),
 *              - the circuit breaker is closed and fewer than `maxAutoSuspendsPerHour` rule suspensions happened in
 *                the last hour (the N+1th attempt trips the breaker instead of suspending),
 *              - the license is active.
 *              Otherwise it degrades to `notify` with the reason as outcome.
 * Rules never revoke: there is no revoke outcome at all.
 */

export type DecisionOutcome =
  | 'off'
  | 'inactive'
  | 'suppressed'
  | 'observed'
  | 'notified'
  | 'monitor_only'
  | 'auto_suspend_disabled'
  | 'circuit_open'
  | 'circuit_tripped'
  | 'suspended'

export type Decision = {
  outcome: DecisionOutcome
  /** Record (or extend) the rule's security event. */
  record: boolean
  /** Admin e-mail for this event. */
  notifyAdmin: boolean
  suspend: boolean
  /** Open the circuit breaker (critical event + admin e-mail). */
  trip: boolean
}

export type DecisionInput = {
  mode: RuleMode
  licenseActive: boolean
  suppressed: boolean
  observeUntil: string | null | undefined
  now: Date
  circuitOpen: boolean
  suspensionsLastHour: number
  maxAutoSuspendsPerHour: number
}

/** Same test as the L1 transition hook: a canonical ISO timestamp strictly in the past. */
export function observationOver(observeUntil: string | null | undefined, now: Date): boolean {
  if (typeof observeUntil !== 'string') return false
  const deadline = Date.parse(observeUntil)
  return deadline < now.getTime() && new Date(deadline).toISOString() === observeUntil
}

const make = (outcome: DecisionOutcome, record: boolean, notifyAdmin: boolean, suspend = false, trip = false): Decision =>
  ({ outcome, record, notifyAdmin, suspend, trip })

export function decide(input: DecisionInput): Decision {
  if (input.mode === 'off') return make('off', false, false)
  if (!input.licenseActive) return make('inactive', false, false)
  if (input.suppressed) return make('suppressed', false, false)
  if (input.mode === 'observe') return make('observed', true, false)
  if (input.mode === 'notify') return make('notified', true, true)
  // mode === 'suspend'
  if (!observationOver(input.observeUntil, input.now)) return make('monitor_only', true, true)
  if (!(input.maxAutoSuspendsPerHour > 0)) return make('auto_suspend_disabled', true, true)
  if (input.circuitOpen) return make('circuit_open', true, true)
  if (input.suspensionsLastHour >= input.maxAutoSuspendsPerHour) return make('circuit_tripped', true, true, false, true)
  return make('suspended', true, true, true)
}
