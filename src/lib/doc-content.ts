export function richTextPlain(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as { text?: unknown; children?: unknown[]; root?: unknown }
  if (typeof node.text === 'string') return node.text
  if (node.root) return richTextPlain(node.root)
  return node.children?.map(richTextPlain).join(' ') ?? ''
}
export function prepareDocContent(value: unknown) {
  const headings: { id: string; text: string }[] = []
  function walk(v: unknown): unknown {
    if (!v || typeof v !== 'object') return v
    const node = v as Record<string, unknown>
    const copy = { ...node }
    if (node.type === 'heading') {
      const id = `doc-heading-${headings.length + 1}`
      headings.push({ id, text: richTextPlain(node) })
      copy.anchor = id
    }
    if (Array.isArray(node.children)) copy.children = node.children.map(walk)
    if (node.root) copy.root = walk(node.root)
    return copy
  }
  return { data: walk(value), headings }
}
