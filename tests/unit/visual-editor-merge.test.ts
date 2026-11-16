import { describe, expect, it } from 'vitest'

import { contentValues, mergeChanges } from '@/editor/canvas/admin/merge'

describe('three-way content merge', () => {
  const a = { id: 'a', blockType: 'cta', heading: 'A', body: 'body' }
  const b = { id: 'b', blockType: 'cta', heading: 'B' }
  const c = { id: 'c', blockType: 'cta', heading: 'C' }
  it('keeps local reorder, remote insertion and disjoint edits on the same row', () => {
    const d = { id: 'd', blockType: 'cta', heading: 'D' }
    const result = mergeChanges({ layout: [a, b, d] }, { layout: [d, { ...a, heading: 'local' }, b] }, { layout: [{ ...a, body: 'remote' }, c, b, d] })
    expect(result.conflicts).toEqual([])
    expect(result.values.layout).toEqual([d, { ...a, heading: 'local', body: 'remote' }, c, b])
  })
  it('preserves a deletion on either side when the other side has not edited that row', () => {
    for (const [local, remote] of [[[a], [a, b, c]], [[a, b, c], [a]]]) {
      const result = mergeChanges({ layout: [a, b] }, { layout: local }, { layout: remote })
      expect(result.conflicts).toEqual([])
      expect(result.values.layout).toEqual([a, c])
    }
  })
  it('reports delete/edit collisions and incompatible reorderings without claiming a clean merge', () => {
    expect(mergeChanges({ layout: [a, b] }, { layout: [a] }, { layout: [a, { ...b, heading: 'remote' }] }).conflicts).toEqual(['layout[b]'])
    expect(mergeChanges({ layout: [a, b, c] }, { layout: [b, a, c] }, { layout: [a, c, b] }).conflicts).toContain('layout (order)')
    expect(mergeChanges({ layout: [a, b] }, { layout: [b, a] }, { layout: [a, c, b] }).conflicts).toContain('layout (order)')
  })
  it('does not merge independent Lexical trees or arrays by numeric index', () => {
    const doc = (text: string) => ({ root: { children: [{ text }] } })
    const result = mergeChanges({ content: doc('base'), tags: ['a'] }, { content: doc('local'), tags: ['b'] }, { content: doc('remote'), tags: ['c'] })
    expect(result.conflicts).toEqual(['content', 'tags'])
  })
  it('merges objects by key, ignoring object key order and preserving remote-only fields', () => {
    const result = mergeChanges({ title: 'base', meta: { title: 'seo', description: 'old' } },
      { title: 'local', meta: { description: 'old', title: 'seo' } }, { title: 'base', meta: { title: 'seo', description: 'new' } })
    expect(result.conflicts).toEqual([])
    expect(result.values).toEqual({ title: 'local', meta: { title: 'seo', description: 'new' } })
  })
  it('copy/merge exports only declared writable content roots and normalises populated relationships', () => {
    const values = contentValues({ title: 'local', editorVersion: 'secret', id: 1, _status: 'draft', password: 'secret', internal: 'secret',
      family: { id: 4, title: 'Populated' }, meta: { image: { id: 3, filename: 'a.png' } } }, [
      { name: 'editorVersion', virtual: true }, { name: 'internal', admin: { readOnly: true } },
      { tabs: [{ fields: [{ name: 'title' }, { name: 'family', type: 'relationship' }, { name: 'meta', fields: [{ name: 'image', type: 'upload' }] }] }] },
    ])
    expect(values).toEqual({ title: 'local', family: 4, meta: { image: 3 } })
  })
})
