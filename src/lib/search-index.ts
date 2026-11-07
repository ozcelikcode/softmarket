/** Shared by live beforeSync and the repair CLI; receives one resolved locale. */
export function searchFields(doc: { title?: unknown; question?: unknown; slug?: unknown; summary?: unknown; excerpt?: unknown }) {
  const text = (value: unknown) => typeof value === 'string' ? value : null
  return {
    title: text(doc.title) ?? text(doc.question) ?? '',
    slug: text(doc.slug),
    excerpt: text(doc.summary) ?? text(doc.excerpt),
  }
}
