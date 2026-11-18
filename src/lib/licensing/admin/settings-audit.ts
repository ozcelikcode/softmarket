import type { GlobalAfterChangeHook } from 'payload'

import { hasPanelAdminSession } from '@/access'
import { requestIP } from '@/lib/forms/security'
import { truncateIp } from '../crypto/ip'

/*
 * L6b `settings.update` audit (plan §4.8): a panel admin's save of `licensing-settings` writes one `security-audit`
 * row inside the same Payload operation transaction (the hook runs with the operation's `req`). The note summarises
 * changed paths with old -> new values for numbers, booleans and short plain strings; arrays (alert e-mails) and any
 * text that looks like an e-mail are named without values. Server writes (signing key lifecycle, overrideAccess, no
 * user) and saves without a change are not audited here (the rotation endpoint writes its own row).
 */

const SKIP = new Set(['id', 'globalType', 'createdAt', 'updatedAt', 'signingKeys', 'editorVersion'])
const MAX_NOTE = 500

type Change = { path: string; from?: unknown; to?: unknown; values: boolean }

function diff(before: unknown, after: unknown, path: string, out: Change[]): void {
  if (out.length > 40) return
  const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
  if (isObject(before) || isObject(after)) {
    const a = isObject(before) ? before : {}
    const b = isObject(after) ? after : {}
    for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      if (!path && SKIP.has(key)) continue
      if (key === 'id') continue
      diff(a[key], b[key], path ? `${path}.${key}` : key, out)
    }
    return
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    if (JSON.stringify(before ?? []) !== JSON.stringify(after ?? [])) out.push({ path, values: false })
    return
  }
  if ((before ?? null) === (after ?? null)) return
  const printable = (v: unknown) => v == null || typeof v === 'number' || typeof v === 'boolean'
    || (typeof v === 'string' && v.length <= 40 && !v.includes('@'))
  out.push({ path, from: before ?? null, to: after ?? null, values: printable(before) && printable(after) })
}

export function summarizeSettingsChange(before: unknown, after: unknown): string | null {
  const changes: Change[] = []
  diff(before, after, '', changes)
  if (!changes.length) return null
  let note = ''
  for (const change of changes) {
    const part = change.values ? `${change.path}: ${String(change.from)} -> ${String(change.to)}` : change.path
    const next = note ? `${note}; ${part}` : part
    if (next.length > MAX_NOTE - 4) return note ? `${note}; …` : `${part.slice(0, MAX_NOTE - 1)}…`
    note = next
  }
  return note
}

export const auditLicensingSettings: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (!hasPanelAdminSession(req)) return doc
  const note = summarizeSettingsChange(previousDoc, doc)
  if (!note) return doc
  const address = requestIP(req.headers)
  await req.payload.create({
    collection: 'security-audit', req, overrideAccess: true, depth: 0,
    data: {
      action: 'settings.update', actorUser: req.user!.id, actorKind: 'admin', reason: 'licensing-settings',
      note, at: new Date().toISOString(), ipPrefix: address === 'unknown' ? null : truncateIp(address), result: 'ok',
    } as never,
  })
  return doc
}
