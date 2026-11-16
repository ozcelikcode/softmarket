/*
 * V5 visual editor: bounded undo/redo stack over immutable snapshots (pure; the admin host stores Payload form
 * states in it). `record(prev)` is called with the state BEFORE a settled change; undo returns the snapshot to
 * restore and keeps the current one for redo.
 */
export type History<T> = { past: T[]; future: T[] }

export const HISTORY_LIMIT = 50

export const emptyHistory = <T>(): History<T> => ({ past: [], future: [] })

export function record<T>(h: History<T>, previous: T, limit = HISTORY_LIMIT): History<T> {
  const past = [...h.past, previous]
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] }
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.past.length) return null
  const state = h.past[h.past.length - 1]!
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future] }, state }
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.future.length) return null
  const [state, ...future] = h.future
  return { history: { past: [...h.past, current], future }, state: state! }
}
