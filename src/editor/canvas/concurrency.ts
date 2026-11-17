import { createHash } from 'node:crypto'
import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionBeforeOperationHook, type GlobalAfterChangeHook, type GlobalBeforeChangeHook, type TextField } from 'payload'

import { isAdminOrEditorField, isAdminOrEditorUser } from '@/access'

/*
 * V5 visual editor: optimistic concurrency for admin writes (P1). Payload's document lock (`lockDocuments`, on by
 * default) only stops a DIFFERENT user from opening/updating a document someone is editing; the same user in
 * another tab, an MCP agent using that user's API key and the editor's own autosave are not covered, so an
 * autosave could silently overwrite a change made elsewhere.
 *
 * - `editorVersion` is a virtual (never stored, no schema/migration), hidden field. It hashes the raw all-locale
 *   document snapshot (including updatedAt); the admin form loads it and sends it with autosave/Save/Publish/flush.
 * - `guardEditorVersion` (collection beforeChange, inside the update transaction) re-reads the latest draft's
 *   token in the SAME SQLite transaction (`BEGIN IMMEDIATE`, see payload.config) and rejects a mismatch with
 *   409, so read-compare-write is atomic: of two concurrent writes from the same base exactly one wins.
 * - Writes WITHOUT an expected version (MCP, content:import, Local API/server code, REST scripts/bulk) behave as before.
 *   An explicit version restore is also an intentional overwrite; its synthetic historical token is ignored.
 *   The next editor save after such a write is then rejected and the editor shows its reload/merge warning.
 */

export const EDITOR_VERSION_FIELD = 'editorVersion'
export const VERSION_CONFLICT_STATUS = 409
export const VERSION_CONFLICT_MESSAGE =
  'Bu belge başka bir yerde değişti; değişikliğiniz kaydedilmedi (ekranda duruyor). / This document changed elsewhere; your change was not saved (it is still on screen).'

const submittedVersions = new WeakMap<object, unknown>()

// Payload leaves this internal flag in a reused Local API req after restoreVersion. It must apply only to
// restores, never opt a subsequent ordinary update out of its explicitly submitted precondition.
export const clearEditorRestoreContext: CollectionBeforeOperationHook = ({ operation, req }) => {
  if (operation === 'update' || operation === 'create') delete req.context.isRestoringVersion
}

// Hash the raw all-locale snapshot, BEFORE field hooks flatten locales or populate relationships.
// updatedAt alone can repeat within a millisecond or move backwards when the system clock changes.
// This field must be first in the collection (plugin.ts). Projected reads are not editor snapshots.
function snapshotVersion(data: Record<string, unknown>): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
      .filter(([key, v]) => key !== EDITOR_VERSION_FIELD && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([key, v]) => [key, canonical(v)]))
    return value
  }
  return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex')
}

export const editorVersionField: TextField = {
  name: EDITOR_VERSION_FIELD,
  type: 'text',
  virtual: true,
  access: { read: isAdminOrEditorField },
  label: { tr: 'Düzenleyici sürümü', en: 'Editor version' },
  admin: { hidden: true, disableListColumn: true, disableListFilter: true },
  hooks: {
    // Payload fills omitted fields from originalDoc after this hook. Preserve actual input presence so
    // an MCP/import partial update does not accidentally acquire an optimistic precondition.
    beforeValidate: [({ data, siblingData }) => {
      if (data) submittedVersions.set(data, siblingData[EDITOR_VERSION_FIELD])
    }],
    afterRead: [({ data, req, overrideAccess }) => (data && (overrideAccess || isAdminOrEditorUser(req.user)) ? snapshotVersion(data) : null)],
  },
}

export const guardEditorVersion: CollectionBeforeChangeHook = async ({ collection, data, operation, originalDoc, req }) => {
  if (!data || typeof data !== 'object') return data
  const expected = submittedVersions.has(data) ? submittedVersions.get(data) : data[EDITOR_VERSION_FIELD]
  delete (data as Record<string, unknown>)[EDITOR_VERSION_FIELD]
  // Restore deliberately replaces content with a historical version. Payload synthesises this field from that
  // historical snapshot; it is NOT a client precondition and must not make every restore fail with 409.
  if (operation !== 'update' || expected === undefined || req.context.isRestoringVersion) return data
  // Editors left open across this deployment carry the previous timestamp contract. Refuse safely and ask
  // them to reload/merge rather than treating an ambiguous timestamp as an authoritative snapshot token.
  if (typeof expected === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(expected)) throw new APIError(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_STATUS, undefined, true)
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new APIError('Invalid editorVersion.', 400, undefined, true)
  const id = (originalDoc as { id?: number | string } | undefined)?.id
  if (id === undefined || id === null) return data
  // Same transaction as the write that follows (req carries it): nothing can commit in between.
  const current = (await req.payload.findByID({
    collection: collection.slug as 'pages' | 'products', id, draft: true, depth: 0, overrideAccess: true, req,
    disableErrors: true,
  })) as { editorVersion?: string } | null
  if (!current?.editorVersion || current.editorVersion !== expected) {
    throw new APIError(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_STATUS, undefined, true)
  }
  return data
}

// A save's in-memory result can contain default/empty groups that SQLite normalises. Return the token of the
// actual stored snapshot, in the same transaction, so a chained save uses exactly what a fresh read would see.
export const savedEditorVersion: CollectionAfterChangeHook = async ({ collection, doc, req }) => {
  const stored = await req.payload.findByID({
    collection: collection.slug as 'pages' | 'products', id: doc.id, draft: true, depth: 0, req, overrideAccess: true,
  })
  if (isAdminOrEditorUser(req.user) || req.payloadAPI === 'local') doc[EDITOR_VERSION_FIELD] = stored.editorVersion
  else delete doc[EDITOR_VERSION_FIELD]
  return doc
}

/*
 * G1: the same optimistic precondition for the site chrome globals (header, footer). Payload's `lockDocuments` also
 * covers globals (`checkDocumentLockStatus` in the global update operation, on by default here) but, as for
 * collections, only against a DIFFERENT user; this guard covers same-user tabs, API-key agents and autosave.
 * The token is the same all-locale snapshot hash; the comparison reads the latest draft-or-published state with
 * `findGlobal({ draft: true })` inside the write's transaction (req). Global version restores do not run
 * beforeChange hooks, so no restore exception is needed here.
 */
type ChromeGlobalSlug = 'header' | 'footer'

export const guardGlobalEditorVersion: GlobalBeforeChangeHook = async ({ data, global, req }) => {
  if (!data || typeof data !== 'object') return data
  const expected = submittedVersions.has(data) ? submittedVersions.get(data) : data[EDITOR_VERSION_FIELD]
  delete (data as Record<string, unknown>)[EDITOR_VERSION_FIELD]
  if (expected === undefined) return data
  if (typeof expected === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(expected)) throw new APIError(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_STATUS, undefined, true)
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw new APIError('Invalid editorVersion.', 400, undefined, true)
  const current = (await req.payload.findGlobal({
    slug: global.slug as ChromeGlobalSlug, draft: true, depth: 0, overrideAccess: true, req,
  })) as { editorVersion?: string } | null
  if (!current?.editorVersion || current.editorVersion !== expected) {
    throw new APIError(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_STATUS, undefined, true)
  }
  return data
}

export const savedGlobalEditorVersion: GlobalAfterChangeHook = async ({ doc, global, req }) => {
  const stored = await req.payload.findGlobal({ slug: global.slug as ChromeGlobalSlug, draft: true, depth: 0, req, overrideAccess: true })
  if (isAdminOrEditorUser(req.user) || req.payloadAPI === 'local') doc[EDITOR_VERSION_FIELD] = (stored as { editorVersion?: string }).editorVersion
  else delete doc[EDITOR_VERSION_FIELD]
  return doc
}
