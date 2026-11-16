import type { FormState } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

// A tiny hook runner keeps refs across renders; no DOM implementation is needed for the async flush paths.
const hooks = vi.hoisted(() => ({ slots: [] as { current: unknown }[], index: 0 }))
vi.mock('react', () => ({
  useRef: (value: unknown) => hooks.slots[hooks.index++] ?? (hooks.slots[hooks.index - 1] = { current: value }),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useState: (value: unknown) => [value, () => {}],
}))
import { useAutosaveFlush } from '@/editor/canvas/admin/sync'

const doc = { apiBase: '/api', collection: 'pages', id: 1, locale: 'tr' }
const fields = (version: string | null, title = 'Local'): FormState => ({ title: { value: title, valid: true }, editorVersion: { value: version, valid: true } })
function Render(overrides: Partial<Parameters<typeof useAutosaveFlush>[0]> = {}) {
  hooks.index = 0
  const props = { doc, fields: fields('base'), modified: true, paused: false, onSaved: vi.fn(), onConflict: vi.fn(), ...overrides }
  return { flush: useAutosaveFlush(props), ...props }
}
afterEach(() => { hooks.slots = []; vi.unstubAllGlobals() })

describe('autosave flush version handling', () => {
  it('does not issue an unguarded request if the form has no version', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await Render({ fields: fields(null) }).flush('await')).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('returns the exact saved baseline along with the new version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ doc: { editorVersion: 'next' } })))
    const state = Render()
    expect(await state.flush('await')).toBe(true)
    expect(state.onSaved).toHaveBeenCalledWith('next', { title: 'Local' })
  })
  it('reports a 409 directly even when the document is hidden (no polling required)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })))
    const state = Render()
    expect(await state.flush('keepalive')).toBe(false)
    expect(state.onConflict).toHaveBeenCalledOnce()
    expect(state.onSaved).not.toHaveBeenCalled()
  })
  it.each(['version', 'locale'] as const)('a delayed response cannot advance the wrong %s', async (change) => {
    let resolve!: (res: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r })))
    const state = Render()
    const pending = state.flush('await')
    const latest = Render(change === 'version' ? { fields: fields('newer') } : { doc: { ...doc, locale: 'en' } })
    resolve(Response.json({ doc: { editorVersion: 'old-response' } }))
    expect(await pending).toBe(false)
    expect(latest.onSaved).not.toHaveBeenCalled()
  })
  it('a delayed conflict response from the previous locale does not flag the new form', async () => {
    let resolve!: (res: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolve = r })))
    const state = Render()
    const pending = state.flush('await')
    const latest = Render({ doc: { ...doc, locale: 'en' } })
    resolve(new Response('{}', { status: 409 }))
    expect(await pending).toBe(false)
    expect(latest.onConflict).not.toHaveBeenCalled()
  })
  it('deduplicates identical pending requests and rejects success responses without a version', async () => {
    let resolve!: (res: Response) => void
    const fetch = vi.fn(() => new Promise<Response>((r) => { resolve = r }))
    vi.stubGlobal('fetch', fetch)
    const state = Render()
    const a = state.flush('await'), b = state.flush('keepalive')
    expect(fetch).toHaveBeenCalledOnce()
    resolve(Response.json({ doc: {} }))
    expect(await Promise.all([a, b])).toEqual([false, false])
    expect(state.onSaved).not.toHaveBeenCalled()
  })
})
