/** JSON values only. Lexical documents and arrays without stable row IDs are indivisible. */
const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const safe = (key: string) => !['__proto__', 'prototype', 'constructor'].includes(key)
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : object(v)
  ? Object.fromEntries(Object.keys(v).filter(safe).sort().map((k) => [k, canonical(v[k])])) : v ?? null
export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

export function mergeChanges(base: Record<string, unknown>, local: Record<string, unknown>, remote: Record<string, unknown>) {
  const conflicts: string[] = []
  const merge = (b: unknown, l: unknown, r: unknown, path: string): unknown => {
    if (sameValue(l, b)) return r
    if (sameValue(r, b) || sameValue(l, r)) return l
    if (object(b) && object(l) && object(r) && !('root' in b) && !('root' in l) && !('root' in r)) {
      return Object.fromEntries([...new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])].filter(safe)
        .map((k) => [k, merge(b[k], l[k], r[k], path ? `${path}.${k}` : k)]))
    }
    if (Array.isArray(b) && Array.isArray(l) && Array.isArray(r)) {
      const ids = (rows: unknown[]): string[] | null => {
        if (rows.some((row) => !object(row) || !['string', 'number'].includes(typeof row.id))) return null
        const keys = rows.map((row) => String((row as Record<string, unknown>).id))
        return new Set(keys).size === keys.length ? keys : null
      }
      const bi = ids(b), li = ids(l), ri = ids(r)
      if (bi && li && ri) {
        const bm = new Map(bi.map((id, i) => [id, b[i]])), lm = new Map(li.map((id, i) => [id, l[i]])), rm = new Map(ri.map((id, i) => [id, r[i]]))
        const values = new Map([...new Set([...bi, ...li, ...ri])].map((id) => [id, merge(bm.get(id), lm.get(id), rm.get(id), `${path}[${id}]`)]))
        const live = (keys: string[]) => keys.filter((id) => values.get(id) !== undefined)
        const common = bi.filter((id) => lm.has(id) && rm.has(id))
        const lo = li.filter((id) => common.includes(id)), ro = ri.filter((id) => common.includes(id))
        const movedLocal = !sameValue(common, lo), movedRemote = !sameValue(common, ro)
        if (movedLocal && movedRemote && !sameValue(lo, ro)) conflicts.push(`${path} (order)`)
        const order = live(movedLocal ? li : ri)
        const other = live(movedLocal ? ri : li)
        // Insert new rows beside their surviving neighbours instead of dropping the other side's additions.
        for (let i = 0; i < other.length; i++) {
          const id = other[i]!
          if (order.includes(id)) continue
          const next = other.slice(i + 1).find((key) => order.includes(key))
          const previous = other.slice(0, i).reverse().find((key) => order.includes(key))
          // A new row's surrounding anchors were reversed by the other editor. There is no order that
          // preserves both intentions; do not silently choose which side of the moved block it belongs on.
          if (previous !== undefined && next !== undefined && order.indexOf(previous) > order.indexOf(next)) conflicts.push(`${path} (order)`)
          order.splice(next === undefined ? order.length : order.indexOf(next), 0, id)
        }
        return order.map((id) => values.get(id))
      }
    }
    conflicts.push(path)
    return l
  }
  return { values: merge(base, local, remote, '') as Record<string, unknown>, conflicts }
}

type Field = { name?: string; type?: string; virtual?: unknown; admin?: { readOnly?: boolean }; fields?: Field[]; tabs?: { fields?: Field[] }[]; blocks?: (Field & { slug: string })[] }
function fieldValue(value: unknown, field: Field): unknown {
  if (field.type === 'relationship' || field.type === 'upload') {
    const id = (v: unknown): unknown => object(v) && 'relationTo' in v ? { relationTo: v.relationTo, value: id(v.value) }
      : object(v) && 'id' in v ? v.id : v
    return Array.isArray(value) ? value.map(id) : id(value)
  }
  const walk = (v: unknown, fields: Field[]): unknown => {
    if (!object(v)) return v
    const result = { ...v }
    const apply = (items: Field[]) => {
      for (const f of items) {
        if (f.name && Object.hasOwn(result, f.name)) result[f.name] = fieldValue(result[f.name], f)
        else if (!f.name) apply(f.fields ?? f.tabs?.flatMap((t) => t.fields ?? []) ?? [])
      }
    }
    apply(fields)
    return result
  }
  if (field.type === 'array' && Array.isArray(value)) return value.map((v) => walk(v, field.fields ?? []))
  if (field.type === 'blocks' && Array.isArray(value)) return value.map((v) => walk(v, field.blocks?.find((b) => b.slug === (object(v) ? v.blockType : null))?.fields ?? []))
  return walk(value, field.fields ?? field.tabs?.flatMap((t) => t.fields ?? []) ?? [])
}
/** Export/merge only writable content roots declared by the collection, never server metadata or virtual fields. */
export function contentValues(values: Record<string, unknown>, fields: Field[]): Record<string, unknown> {
  const entries: [string, unknown][] = []
  for (const f of fields) {
    if (f.name) {
      if (safe(f.name) && !f.virtual && f.type !== 'join' && !f.admin?.readOnly && !['id', 'updatedAt', 'createdAt', '_status', 'editorVersion'].includes(f.name)
        && Object.hasOwn(values, f.name)) entries.push([f.name, fieldValue(values[f.name], f)])
    } else {
      entries.push(...Object.entries(contentValues(values, f.fields ?? f.tabs?.flatMap((tab) => tab.fields ?? []) ?? [])))
    }
  }
  return Object.fromEntries(entries)
}
