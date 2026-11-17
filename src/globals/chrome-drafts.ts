import { APIError, ValidationError, type GlobalAfterChangeHook, type GlobalBeforeOperationHook, type GlobalConfig, type PayloadRequest } from 'payload'

import { isAllowedLinkUrl } from '@/lib/safe-href'
import { validationMessage } from '@/lib/validation-messages'

/*
 * G1 (plan-visual-globals): header and footer have drafts + autosave so the visual chrome editor can try changes
 * without publishing them. Payload 3.93 globals have one main row that public reads use WITHOUT looking at
 * `_status` (G0 matrix D/E): a write that sets `_status: 'draft'` without `draft: true` updates the main row and the
 * "draft" content is immediately public, and a global version restore writes the main row directly (also with
 * `draft: true`). Both are refused here so a draft can only ever live in the versions table:
 * - update: `_status: 'draft'` is allowed only together with `draft: true` (admin autosave, MCP/REST `draft`).
 *   This also covers the admin "Unpublish" action, which would otherwise leave the content public.
 * - restoreVersion: only a published version, and never "restore as draft".
 * The check runs in `beforeOperation` (inside the operation's transaction, before any write) because global
 * `beforeChange` hooks do not receive the `draft` argument in Payload 3.93.
 * Imports and the MCP recipe always send `_status: 'published'` (AGENTS.md).
 */

export const CHROME_AUTOSAVE_INTERVAL = 2000
export const CHROME_DRAFT_GLOBALS = ['header', 'footer'] as const

export const chromeVersions: GlobalConfig['versions'] = {
  drafts: { autosave: { interval: CHROME_AUTOSAVE_INTERVAL } },
  max: 50,
}

// Keep the published baseline outside client-controlled context. Validation's previousValue is the latest
// draft, which must not grandfather a newly invalid URL merely because autosave has already stored it.
const publishedBeforeWrite = new WeakMap<PayloadRequest, Map<string, Record<string, unknown>>>()

export const guardGlobalDraftStatus: GlobalBeforeOperationHook = async ({ args, global, operation, req }) => {
  if (operation === 'update') {
    // Payload 3.93 passes the projected main-row result to saveVersion, losing unselected content and status.
    // Refuse projected writes atomically; callers can use select on a separate read.
    if (args.select) throw new APIError('Header/footer writes do not support select. Use a separate projected read.', 400, undefined, true)
    const status = (args?.data as { _status?: unknown } | undefined)?._status
    // Updates merge with the latest VERSION, not the public main row. Omitting status after an autosave would
    // copy that draft into the main row. Keep legacy status-less writes only when there is no pending draft.
    const inheritedDraft = status === undefined && !args?.draft && (await req.payload.db.findGlobalVersions({
      global: global.slug, where: { latest: { equals: true } }, limit: 1, req,
    })).docs.some((version) => version.version._status === 'draft')
    if (!args?.draft && ((status !== undefined && status !== 'published') || inheritedDraft)) {
      throw new ValidationError({ global: global.slug, req, errors: [{ path: '_status', message: validationMessage(req, 'globalDraftStatusWithoutDraft') }] }, req.t)
    }
    if (!args.draft && status === undefined) args.data._status = 'published'
  }
  if (operation === 'restoreVersion') {
    let published = false
    if (!args?.draft && args?.id !== undefined) {
      const version = await req.payload.findGlobalVersionByID({
        slug: global.slug as 'header' | 'footer', id: String(args.id), depth: 0, overrideAccess: true, req, disableErrors: true,
      }).catch(() => null)
      published = (version?.version as { _status?: string } | undefined)?._status === 'published'
    }
    if (!published) {
      throw new ValidationError({ global: global.slug, req, errors: [{ path: '_status', message: validationMessage(req, 'globalDraftRestore') }] }, req.t)
    }
  }
  if (operation === 'restoreVersion' || (operation === 'update' && (!args.draft || args.data._status === 'published'))) {
    const snapshots = publishedBeforeWrite.get(req) ?? new Map<string, Record<string, unknown>>()
    snapshots.set(global.slug, await req.payload.db.findGlobal({ slug: global.slug, req }) ?? {})
    publishedBeforeWrite.set(req, snapshots)
  }
  return args
}

export const validatePublishedChromeLinks: GlobalAfterChangeHook = async ({ doc, global, req }) => {
  if ((doc?.version?._status ?? doc?._status) !== 'published') return doc
  const current = await req.payload.db.findGlobal({ slug: global.slug, req })
  const previous = publishedBeforeWrite.get(req)?.get(global.slug) ?? {}
  // A draft save leaves the main row untouched. Inspect all locales, without fallback or projections.
  const errors: { path: string; message: string }[] = []
  const visit = (value: unknown, before: unknown, path: string[]) => {
    if (Array.isArray(value)) {
      const rows = Array.isArray(before) ? before : []
      value.forEach((row, index) => visit(row, rows.find((old) => old.id === row.id), [...path, String(index)]))
    } else if (value && typeof value === 'object') {
      const old = before && typeof before === 'object' ? before as Record<string, unknown> : {}
      for (const [key, child] of Object.entries(value)) {
        if (key === 'url') {
          const locales = child && typeof child === 'object' ? child : { value: child }
          const prior = old[key] && typeof old[key] === 'object' ? old[key] as Record<string, unknown> : { value: old[key] }
          for (const [locale, url] of Object.entries(locales)) {
            if (!isAllowedLinkUrl(url, prior[locale])) errors.push({ path: [...path, key].join('.'), message: validationMessage(req, 'linkUrlInvalid') })
          }
        } else visit(child, old[key], [...path, key])
      }
    }
  }
  visit(current, previous, [])
  if (errors.length) throw new ValidationError({ global: global.slug, req, errors }, req.t)
  return doc
}
