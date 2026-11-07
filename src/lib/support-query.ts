/** Query values are scalars; repeated, excessive and unknown values fail closed. */
export type Query = Record<string, string | string[] | undefined>
export function boundedQuery(value: Query[string], max = 100): string | null {
  return value === undefined
    ? ''
    : typeof value === 'string' && value.length <= max
      ? value.trim()
      : null
}
export function searchQuery(value: Query[string]): string | null {
  const q = boundedQuery(value, 120)
  // Payload's SQLite contains operator passes LIKE wildcards through unescaped.
  return q !== null && !/[%_]/.test(q) && (q === '' || q.length >= 2) ? q : null
}
export function quoteSelection<
  T extends { id: number; slug?: string | null },
  E extends { sku: string; product: number | { id: number } },
>(products: T[], editions: E[], productSlug: Query[string], sku: Query[string]) {
  const product = products.find((p) => p.slug === boundedQuery(productSlug))
  const edition =
    product &&
    editions.find(
      (e) =>
        e.sku === boundedQuery(sku, 64) &&
        (typeof e.product === 'object' ? e.product.id : e.product) === product.id,
    )
  return { product: product?.slug ?? '', sku: edition?.sku ?? '' }
}
