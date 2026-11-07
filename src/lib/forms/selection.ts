import { quoteSelection, type Query } from '@/lib/support-query'

type Product = { id: number; slug?: string | null }
type Edition = { sku: string; product: number | { id: number } }

/**
 * Product/edition pair check for lead forms. An empty value is fine; a non-empty value must resolve:
 * the product must exist and the SKU must be one of that product's editions. Returns field names to flag.
 */
export function selectionErrors(
  products: Product[],
  editions: Edition[],
  product: Query[string],
  sku: Query[string],
): Record<string, string> {
  const selected = quoteSelection(products, editions, product, sku)
  const errors: Record<string, string> = {}
  if (product && !selected.product) errors.product = 'invalid'
  if (sku && !selected.sku) errors.sku = 'invalid'
  return errors
}
