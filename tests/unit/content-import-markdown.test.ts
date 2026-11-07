import { beforeAll, describe, expect, it } from 'vitest'
import type { SanitizedConfig } from 'payload'
import { convertMarkdownToLexical, defaultEditorConfig, sanitizeServerEditorConfig } from '@payloadcms/richtext-lexical'
import { allowedImportURL, sanitizeLexical } from '../../src/lib/content-import/markdown'

let editorConfig: Awaited<ReturnType<typeof sanitizeServerEditorConfig>>
beforeAll(async () => {
  editorConfig = await sanitizeServerEditorConfig(defaultEditorConfig, { collections: [], globals: [] } as unknown as SanitizedConfig)
})
function allNodes(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== 'object') return []
  const node = value as Record<string, unknown>
  return [node, ...Object.values(node).flatMap(value => Array.isArray(value) ? value.flatMap(allNodes) : allNodes(value))]
}
describe('import Markdown safety', () => {
  it.each(['javascript:alert', 'JaVaScRiPt:alert', 'data:text/html,evil', 'vbscript:evil', '//evil.test', 'java\nscript:evil', '/\\evil.test', 'ftp://evil.test'])('unwraps unsafe links and auto-links: %s', url => {
    expect(allowedImportURL(url)).toBe(false)
    for (const type of ['link', 'autolink']) {
      for (const target of [{ fields: { url, linkType: 'custom' } }, { url }]) {
        const tree = { root: { type: 'root', children: [{ type, ...target, children: [{ type: 'text', text: 'visible' }] }] } }
        expect(sanitizeLexical(tree)).toEqual({ root: { type: 'root', children: [{ type: 'text', text: 'visible' }] } })
      }
    }
  })
  it.each(['https://example.com', 'http://example.com', 'mailto:a@example.com', 'tel:+90123', '/tr/destek', './guide', '../guide', 'guide/start', '#intro', '?page=2'])('preserves allowed URL %s', url => {
    expect(allowedImportURL(url)).toBe(true)
    const tree = { root: { children: [{ type: 'link', fields: { url }, children: [{ type: 'text', text: 'safe' }] }] } }
    expect(sanitizeLexical(tree)).toEqual(tree)
  })
  it('sanitizes actual Markdown conversion, retaining HTML only as text', () => {
    const converted = convertMarkdownToLexical({ editorConfig, markdown: '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:evil) [data](data:text/html,evil) [vb](vbscript:evil) [good](https://example.com)\n\n<javascript:evil>' })
    const nodes = allNodes(sanitizeLexical(converted))
    expect(nodes.filter(n => ['link', 'autolink'].includes(String(n.type)))).toEqual([
      expect.objectContaining({ fields: expect.objectContaining({ url: 'https://example.com' }) }),
    ])
    expect(nodes.some(n => ['html', 'raw', 'rawHTML'].includes(String(n.type)))).toBe(false)
    expect(nodes.some(n => n.type === 'text' && String(n.text).includes('<script>'))).toBe(true)
  })
  it('discards raw HTML nodes defensively', () => {
    expect(sanitizeLexical({ root: { children: [{ type: 'html', html: '<script>evil</script>' }] } })).toEqual({ root: { children: [] } })
  })
})
