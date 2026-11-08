import type { ReactNode } from 'react'

import type { Crumb } from '@/components/ui/breadcrumb'
import type { BlockContext } from '@/lib/blocks/render-plan'
import type { ProductSectionId } from '@/lib/blocks/product-composition'
import type { Download, Edition, Page, Product, ProductFamily } from '@/payload-types'

/**
 * Union of all layout block shapes (pages/products/solutions/case-studies share one block set; products add the
 * V2 product-bound sections).
 */
export type LayoutBlock = NonNullable<Page['layout']>[number] | NonNullable<Product['layout']>[number]
export type LayoutBlockType = LayoutBlock['blockType']
export type BlockOf<T extends LayoutBlockType> = Extract<LayoutBlock, { blockType: T }>

/** Data of the product page, read by the product-bound blocks (V2). Loaded once by the page. */
export type ProductSlot = {
  family: Pick<ProductFamily, 'title'>
  product: Product
  editions: Edition[]
  downloads: Download[]
  docSlug: string | null
  productSlug: string
  /** Locale-neutral path of the product page (`/urunler/<family>/<product>`). */
  path: string
  trail: Crumb[]
  /** Sections in page order that the sticky nav links to. */
  sections: ProductSectionId[]
}

/**
 * Page-provided content for placeholder blocks (F6: `listing` = the system page's own list; V2: `product` = the
 * product page data for product-bound blocks).
 */
export type BlockSlots = { listing?: ReactNode; product?: ProductSlot }
export type BlockProps<B> = { block: B; locale: string; ctx: BlockContext; slots?: BlockSlots }
/** Server component (sync or async) rendering one block. */
export type BlockComponent<B> = (props: BlockProps<B>) => ReactNode | Promise<ReactNode>
