import { describe, expect, it } from 'vitest'

import { emptyHistory, record, redo, undo } from '@/editor/canvas/history'
import { acceptMessage, bridgeMessage, CANVAS_NS, CANVAS_VERSION, envelope, hostMessage } from '@/editor/canvas/protocol'
import {
  canvasLocks, compatFilteredRows, isCanvasCollection, moveIndex, needsMaterialize, paletteTypes, planMove, rowIndexOf,
} from '@/editor/canvas/rules'
import { VISUAL_EDITOR_LABELS } from '@/lib/admin-i18n'

/* V5 visual editor bridge: message gate (origin AND source, strict allowlist), id/locale addressing, V2 rules. */

const origin = 'http://127.0.0.1:3530'
const parent = { name: 'parent' }
const ok = { origin, source: parent }
const ev = (data: unknown, over: Partial<{ origin: string; source: unknown }> = {}) =>
  ({ origin, source: parent, data, ...over }) as Pick<MessageEvent, 'origin' | 'source' | 'data'>
const ID = '6720f1c2a1b2c3d4e5f60718'

describe('postMessage gate', () => {
  const select = envelope({ type: 'select', id: ID })

  it('accepts a valid message from the expected peer only', () => {
    expect(acceptMessage(ev(select), ok, bridgeMessage)).toEqual(select)
    expect(select).toMatchObject({ ns: CANVAS_NS, v: CANVAS_VERSION })
  })

  it.each([
    ['foreign origin', ev(select, { origin: 'http://evil.test' })],
    ['origin prefix trick', ev(select, { origin: `${origin}.evil.test` })],
    ['"null" origin (sandboxed/file)', ev(select, { origin: 'null' })],
    ['same origin, other window (popup / sibling frame)', ev(select, { source: { name: 'popup' } })],
    ['null source', ev(select, { source: null })],
  ])('rejects %s', (_, e) => {
    expect(acceptMessage(e, ok, bridgeMessage)).toBeNull()
  })

  it('rejects everything while the peer or origin is unknown', () => {
    expect(acceptMessage(ev(select), { origin, source: null }, bridgeMessage)).toBeNull()
    expect(acceptMessage(ev(select), { origin: '', source: parent }, bridgeMessage)).toBeNull()
  })

  it.each([
    ['unknown type', { type: 'exec', code: 'x' }],
    ['extra key', { type: 'select', id: ID, html: '<b>' }],
    ['bad block id', { type: 'select', id: '../../x' }],
    ['block id with markup', { type: 'remove', id: '<img src=x>' }],
    ['link url path', { type: 'text', scope: 'block', id: ID, locale: 'tr', path: 'actions.0.link.url', value: 'javascript:alert(1)' }],
    ['prototype path', { type: 'text', scope: 'block', id: ID, locale: 'tr', path: '__proto__.polluted', value: 'x' }],
    ['constructor path', { type: 'text', scope: 'doc', id: null, locale: 'tr', path: 'constructor.prototype', value: 'x' }],
    ['unknown locale', { type: 'text', scope: 'doc', id: null, locale: 'de', path: 'title', value: 'x' }],
    ['missing locale', { type: 'text', scope: 'doc', id: null, path: 'title', value: 'x' }],
    ['control characters', { type: 'text', scope: 'doc', id: null, locale: 'tr', path: 'title', value: 'a\nb' }],
    ['too long text', { type: 'text', scope: 'doc', id: null, locale: 'tr', path: 'title', value: 'x'.repeat(1001) }],
    ['bad move place', { type: 'move', id: ID, target: ID, place: 'inside' }],
    ['hide without flag', { type: 'hide', id: ID }],
    ['too many blocks', { type: 'ready', blocks: Array.from({ length: 301 }, () => ({ id: ID, type: 'cta' })) }],
    ['history action', { type: 'history', action: 'eval' }],
  ])('rejects %s', (_, body) => {
    expect(acceptMessage(ev(envelope(body as object)), ok, bridgeMessage)).toBeNull()
  })

  it('rejects other versions, namespaces and non-objects (Payload live-preview messages pass silently)', () => {
    expect(acceptMessage(ev({ ...select, v: 1 }), ok, bridgeMessage)).toBeNull()
    expect(acceptMessage(ev({ ...select, ns: 'other' }), ok, bridgeMessage)).toBeNull()
    expect(acceptMessage(ev({ type: 'payload-live-preview', data: {} }), ok, bridgeMessage)).toBeNull()
    for (const data of [null, 'select', 42, [select]]) expect(acceptMessage(ev(data), ok, bridgeMessage)).toBeNull()
  })

  it('accepts the full bridge vocabulary', () => {
    for (const body of [
      { type: 'ready', blocks: [{ id: ID, type: 'cta' }, { id: 'virtual:productHero', type: 'productHero' }] },
      { type: 'select', id: null },
      { type: 'move', id: ID, target: 'virtual:productEditions', place: 'after' },
      { type: 'duplicate', id: ID }, { type: 'hide', id: ID, hidden: false }, { type: 'remove', id: ID }, { type: 'insert', after: null },
      { type: 'textBegin', scope: 'block', id: ID, path: 'items.2.title', locale: 'en' },
      { type: 'text', scope: 'doc', id: null, path: 'title', locale: 'tr', value: 'Yeni başlık' },
      { type: 'textEnd' }, { type: 'history', action: 'redo' },
    ]) expect(acceptMessage(ev(envelope(body)), ok, bridgeMessage), body.type).not.toBeNull()
  })

  it('host -> bridge messages use the same gate and allowlist', () => {
    const host = envelope({ type: 'host', collection: 'products', lang: 'tr', locked: canvasLocks('products'), labels: { cta: 'Çağrı' }, selected: null, canUndo: false, canRedo: true })
    expect(acceptMessage(ev(host), ok, hostMessage)).toEqual(host)
    expect(acceptMessage(ev(host, { source: { name: 'sibling-frame' } }), ok, hostMessage)).toBeNull()
    expect(acceptMessage(ev({ ...host, collection: 'users' }), ok, hostMessage)).toBeNull()
    expect(acceptMessage(ev({ ...host, labels: { __proto__x: 'x' } }), ok, hostMessage)).toBeNull()
    expect(acceptMessage(ev(envelope({ type: 'notice', message: 'x'.repeat(301) })), ok, hostMessage)).toBeNull()
    expect(acceptMessage(ev(envelope({ type: 'textGrant', path: 'title', id: null, ok: true, fallback: false })), ok, hostMessage)).not.toBeNull()
  })
})

describe('V2 product rules and id addressing', () => {
  const rows = [
    { id: 'h', blockType: 'productHero' }, { id: 'n', blockType: 'productNav' }, { id: 'f', blockType: 'productFeatures' },
    { id: 'e', blockType: 'productEditions' }, { id: 'c', blockType: 'cta' },
  ]

  it('locks hero/editions (remove, hide), hero (move) and bound singletons (duplicate); pages are free', () => {
    const locks = canvasLocks('products')
    expect(locks.remove).toEqual(['productHero', 'productEditions'])
    expect(locks.hide).toEqual(['productHero', 'productEditions'])
    expect(locks.move).toEqual(['productHero'])
    expect(locks.duplicate).toContain('productNav')
    expect(locks.duplicate).not.toContain('cta')
    expect(canvasLocks('pages')).toEqual({ remove: [], hide: [], move: [], duplicate: [] })
  })

  it('keeps the product hero first', () => {
    expect(planMove('products', rows, 0, 2)).toEqual({ ok: false, reason: 'heroFirst' })
    expect(planMove('products', rows, 3, 0)).toEqual({ ok: false, reason: 'heroFirst' })
    expect(planMove('products', rows, 3, 2)).toEqual({ ok: true })
    expect(planMove('pages', rows, 3, 0)).toEqual({ ok: true })
    expect(planMove('products', rows, 9, 1).ok).toBe(false)
    expect(planMove('products', rows, 1, 1).ok).toBe(false)
  })

  it('maps before/after targets to moveFieldRow indices', () => {
    // Move e (3) before f (2) -> 2; move f (2) after e (3) -> 3; move n (1) before c (4) -> 3.
    expect(moveIndex(3, 2, 'before')).toBe(2)
    expect(moveIndex(2, 3, 'after')).toBe(3)
    expect(moveIndex(1, 4, 'before')).toBe(3)
    expect(moveIndex(4, 1, 'after')).toBe(2)
  })

  it('resolves stored ids by identity and virtual ids by their bound type, never by a stale index', () => {
    expect(rowIndexOf(rows, 'c')).toBe(4)
    expect(rowIndexOf(rows, 'virtual:productEditions')).toBe(3)
    expect(rowIndexOf(rows, 'virtual:cta')).toBe(-1)
    expect(rowIndexOf(rows, 'virtual:productDocs')).toBe(-1)
    expect(rowIndexOf(rows, 'gone')).toBe(-1)
  })

  it('compatibility products materialise first; the pre-V2 duplicate filter becomes hidden rows', () => {
    expect(needsMaterialize('products', [{ id: 'x', blockType: 'cta' }])).toBe(true)
    expect(needsMaterialize('products', rows)).toBe(false)
    expect(needsMaterialize('pages', [])).toBe(false)
    const legacy = [{ id: 'a', blockType: 'hero' }, { id: 'b', blockType: 'featureGrid' }, { id: 'c', blockType: 'specTable' }, { id: 'd', blockType: 'cta' }]
    expect(compatFilteredRows(legacy, { features: true, specs: false })).toEqual([0, 1])
  })

  it('palette offers missing bound sections on products only and listing on system pages only', () => {
    const all = ['hero', 'cta', 'listing', 'productHero', 'productDocs']
    expect(paletteTypes('products', all, rows, { systemPage: false })).toEqual(['hero', 'cta', 'productDocs'])
    expect(paletteTypes('pages', all, [], { systemPage: false })).toEqual(['hero', 'cta'])
    expect(paletteTypes('pages', all, [], { systemPage: true })).toEqual(['hero', 'cta', 'listing'])
    expect(isCanvasCollection('pages')).toBe(true)
    expect(isCanvasCollection('users')).toBe(false)
  })
})

describe('undo/redo history', () => {
  it('records, undoes, redoes and caps the stack', () => {
    let h = emptyHistory<number>()
    h = record(h, 1)
    h = record(h, 2)
    const u = undo(h, 3)!
    expect(u.state).toBe(2)
    const r = redo(u.history, 2)!
    expect(r.state).toBe(3)
    expect(undo(emptyHistory<number>(), 1)).toBeNull()
    expect(redo(h, 1)).toBeNull()
    let big = emptyHistory<number>()
    for (let i = 0; i < 60; i++) big = record(big, i, 50)
    expect(big.past).toHaveLength(50)
    expect(big.past[0]).toBe(10)
    expect(record(u.history, 9).future).toEqual([])
  })
})

describe('labels', () => {
  it('every visual editor label has TR and EN text, and they differ', () => {
    const walk = (v: unknown, path: string): [string, { tr: string; en: string }][] =>
      v && typeof v === 'object' && 'tr' in v && 'en' in v ? [[path, v as { tr: string; en: string }]]
        : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => walk(x, `${path}.${k}`)) : []
    const all = walk(VISUAL_EDITOR_LABELS, 'VE')
    expect(all.length).toBeGreaterThan(50)
    for (const [path, l] of all) {
      expect(l.tr.trim(), path).not.toBe('')
      expect(l.en.trim(), path).not.toBe('')
      if (l.tr.length > 4) expect(l.tr, path).not.toBe(l.en)
    }
    expect(VISUAL_EDITOR_LABELS.tour.steps).toHaveLength(4)
  })
})
