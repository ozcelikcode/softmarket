import { APIError, type CollectionBeforeChangeHook, type TextField } from 'payload'

/*
 * V5 visual editor: optimistic concurrency for admin writes (P1). Payload's document lock (`lockDocuments`, on by
 * default) only stops a DIFFERENT user from opening/updating a document someone is editing; the same user in
 * another tab, an MCP agent using that user's API key and the editor's own autosave are not covered, so an
 * autosave could silently overwrite a change made elsewhere.
 *
 * - `editorVersion` is a virtual (never stored, no schema/migration), hidden field. On every read it is the
 *   document's current `updatedAt` (the latest draft when read as draft), so the admin form loads it with the
 *   document and sends it back with every save (Payload autosave, Save/Publish, the editor's pagehide flush).
 * - `guardEditorVersion` (collection beforeChange, inside the update transaction) re-reads the latest draft's
 *   `updatedAt` in the SAME SQLite transaction (`BEGIN IMMEDIATE`, see payload.config) and rejects a mismatch with
 *   409, so read-compare-write is atomic: of two concurrent writes from the same base exactly one wins.
 * - Writes WITHOUT an expected version (MCP, content:import, Local API/server code, REST scripts) behave as before.
 *   The next editor save after such a write is then rejected and the editor shows its reload/merge warning.
 */

export const EDITOR_VERSION_FIELD = 'editorVersion'
export const VERSION_CONFLICT_STATUS = 409
export const VERSION_CONFLICT_MESSAGE =
  'Bu belge başka bir yerde değişti; değişikliğiniz kaydedilmedi (ekranda duruyor). / This document changed elsewhere; your change was not saved (it is still on screen).'

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/

export const editorVersionField: TextField = {
  name: EDITOR_VERSION_FIELD,
  type: 'text',
  virtual: true,
  label: { tr: 'Düzenleyici sürümü', en: 'Editor version' },
  admin: { hidden: true, disableListColumn: true, disableListFilter: true },
  hooks: {
    afterRead: [({ data }) => (typeof data?.updatedAt === 'string' ? data.updatedAt : null)],
  },
}

export const guardEditorVersion: CollectionBeforeChangeHook = async ({ collection, data, operation, originalDoc, req }) => {
  if (!data || typeof data !== 'object') return data
  const expected = (data as Record<string, unknown>)[EDITOR_VERSION_FIELD]
  delete (data as Record<string, unknown>)[EDITOR_VERSION_FIELD]
  if (operation !== 'update' || expected === undefined || expected === null || expected === '') return data
  if (typeof expected !== 'string' || !ISO.test(expected)) throw new APIError('Invalid editorVersion.', 400, undefined, true)
  const id = (originalDoc as { id?: number | string } | undefined)?.id
  if (id === undefined || id === null) return data
  // Same transaction as the write that follows (req carries it): nothing can commit in between.
  const current = (await req.payload.findByID({
    collection: collection.slug as 'pages' | 'products', id, draft: true, depth: 0, overrideAccess: true, req,
    disableErrors: true, select: { updatedAt: true } as never,
  })) as { updatedAt?: string } | null
  if (typeof current?.updatedAt === 'string' && current.updatedAt !== expected) {
    throw new APIError(VERSION_CONFLICT_MESSAGE, VERSION_CONFLICT_STATUS, { expected, current: current.updatedAt }, true)
  }
  return data
}
