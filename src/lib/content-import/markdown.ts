/** Fail closed for link schemes, including links introduced by auto-link transforms. */
export function allowedImportURL(value: unknown): boolean {
  if (typeof value !== 'string' || !value || /[\s\u0000-\u001f\u007f\\]/u.test(value) || value.startsWith('//')) return false
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    try { return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol) } catch { return false }
  }
  // A colon before the first path/query/fragment separator is not a relative URL.
  return !value.split(/[/?#]/, 1)[0].includes(':')
}

/** Raw HTML stays plain text in Payload's Markdown converter; discard HTML nodes
 * defensively and unwrap unsafe links while preserving their visible text. */
export function sanitizeLexical(value: unknown): unknown {
  function nodes(value: unknown): unknown[] {
    if (!value || typeof value !== 'object') return [value]
    const node = value as Record<string, unknown>
    if (node.type === 'html' || node.type === 'raw' || node.type === 'rawHTML') return []
    const children = Array.isArray(node.children) ? node.children.flatMap(nodes) : undefined
    if (node.type === 'link' || node.type === 'autolink') {
      const fields = node.fields as Record<string, unknown> | undefined
      if (!allowedImportURL(fields?.url ?? node.url)) return children ?? []
    }
    return [{ ...node, ...(children ? { children } : {}), ...(node.root ? { root: nodes(node.root)[0] } : {}) }]
  }
  return nodes(value)[0]
}
