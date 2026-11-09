import * as z from 'zod/mini'

import { INLINE_MAX, isSafeFieldPath } from '@/editor/canvas/fields'

/*
 * V5 visual editor: postMessage protocol between the draft-mode site bridge (Live Preview iframe) and the admin
 * host (document edit view). Both pages are same-origin. Every message is checked on BOTH sides for
 *   1. event.origin === window.location.origin,
 *   2. event.source === the expected peer window (iframe.contentWindow <-> window.parent), and
 *   3. a strict allowlist schema (unknown types, extra keys, bad ids/paths/locales are rejected).
 * Payload's own live-preview messages (no `ns`) are ignored silently. Addressing is by stored block id + locale,
 * never by a rendered index. The bridge never writes to the API: every change goes through the admin document
 * form (field validation, access control, autosave/publish on the server). `zod/mini` keeps the staff-only
 * bridge chunk small.
 */

export const CANVAS_NS = 'sm-canvas'
export const CANVAS_VERSION = 2

/** Stored row id (Payload ObjectId hex / uuid-like) or a virtual compatibility-mode product section. */
export const BLOCK_ID_RE = /^(?:virtual:[A-Za-z]{1,40}|[A-Za-z0-9_-]{1,64})$/
export const BLOCK_TYPE_RE = /^[A-Za-z]{1,40}$/
const MAX_BLOCKS = 300

const blockId = z.string().check(z.regex(BLOCK_ID_RE))
const blockType = z.string().check(z.regex(BLOCK_TYPE_RE))
const fieldPath = z.string().check(z.refine(isSafeFieldPath))
const locale = z.enum(['tr', 'en'])
/** textContent only: one line, no control characters. */
const plainText = z.string().check(z.maxLength(INLINE_MAX), z.regex(/^[^\u0000-\u001f\u007f]*$/))
const scope = z.enum(['block', 'doc'])

const base = { ns: z.literal(CANVAS_NS), v: z.literal(CANVAS_VERSION) }

/** Site bridge (iframe) -> admin host (parent). */
export const bridgeMessage = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('ready'), blocks: z.array(z.strictObject({ id: blockId, type: blockType })).check(z.maxLength(MAX_BLOCKS)) }),
  z.strictObject({ ...base, type: z.literal('select'), id: z.nullable(blockId) }),
  /** Move `id` before/after `target`; both are resolved from the CURRENT form state by the host. */
  z.strictObject({ ...base, type: z.literal('move'), id: blockId, target: blockId, place: z.enum(['before', 'after']) }),
  z.strictObject({ ...base, type: z.literal('duplicate'), id: blockId }),
  z.strictObject({ ...base, type: z.literal('hide'), id: blockId, hidden: z.boolean() }),
  z.strictObject({ ...base, type: z.literal('remove'), id: blockId }),
  /** Opens the block palette in the admin; the new block goes after `after` (null = at the top). */
  z.strictObject({ ...base, type: z.literal('insert'), after: z.nullable(blockId) }),
  /** Ask the host whether an inline field may be edited (exists, plain one-line string, current locale). */
  z.strictObject({ ...base, type: z.literal('textBegin'), scope, id: z.nullable(blockId), path: fieldPath, locale }),
  z.strictObject({ ...base, type: z.literal('text'), scope, id: z.nullable(blockId), path: fieldPath, locale, value: plainText }),
  z.strictObject({ ...base, type: z.literal('textEnd') }),
  z.strictObject({ ...base, type: z.literal('history'), action: z.enum(['undo', 'redo']) }),
])
export type BridgeMessage = z.infer<typeof bridgeMessage>

const typeList = z.array(blockType).check(z.maxLength(40))

/** Admin host (parent) -> site bridge (iframe). */
export const hostMessage = z.discriminatedUnion('type', [
  z.strictObject({
    ...base,
    type: z.literal('host'),
    collection: z.enum(['products', 'pages']),
    /** Admin UI language (toolbar labels). */
    lang: locale,
    /** Block TYPES whose actions are disabled (V2: productHero, productEditions …). */
    locked: z.strictObject({ remove: typeList, hide: typeList, move: typeList, duplicate: typeList }),
    /** Display names of block types (admin language). */
    labels: z.record(blockType, z.string().check(z.maxLength(80))),
    selected: z.nullable(blockId),
    canUndo: z.boolean(),
    canRedo: z.boolean(),
  }),
  z.strictObject({ ...base, type: z.literal('select'), id: z.nullable(blockId) }),
  z.strictObject({ ...base, type: z.literal('notice'), message: z.string().check(z.maxLength(300)) }),
  /** Answer to `textBegin`; `fallback`: the stored value is empty (the canvas shows a fallback text). */
  z.strictObject({ ...base, type: z.literal('textGrant'), path: fieldPath, id: z.nullable(blockId), ok: z.boolean(), fallback: z.boolean() }),
])
export type HostMessage = z.infer<typeof hostMessage>

type Without<T> = T extends unknown ? Omit<T, 'ns' | 'v'> : never
export type BridgeMessageBody = Without<BridgeMessage>
export type HostMessageBody = Without<HostMessage>

/**
 * Gate shared by both sides: same origin AND the expected peer window, then strict schema parse.
 * Returns null for anything else (including Payload's own live-preview messages).
 */
export function acceptMessage<T>(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  expected: { origin: string; source: unknown },
  schema: z.ZodMiniType<T>,
): T | null {
  if (!expected.origin || event.origin !== expected.origin) return null
  if (!expected.source || event.source !== expected.source) return null
  const data = event.data as { ns?: unknown } | null
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.ns !== CANVAS_NS) return null
  const parsed = schema.safeParse(data)
  return parsed.success ? parsed.data : null
}

export const envelope = <T extends object>(body: T) => ({ ns: CANVAS_NS, v: CANVAS_VERSION, ...body })
