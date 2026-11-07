import type { ReactNode } from 'react'

import type { BlockContext } from '@/lib/blocks/render-plan'
import type { Page } from '@/payload-types'

/** Union of all layout block shapes (pages/products/solutions/case-studies share one block set). */
export type LayoutBlock = NonNullable<Page['layout']>[number]
export type LayoutBlockType = LayoutBlock['blockType']
export type BlockOf<T extends LayoutBlockType> = Extract<LayoutBlock, { blockType: T }>

/** Page-provided content for placeholder blocks (F6: `listing` = the system page's own list). */
export type BlockSlots = { listing?: ReactNode }
export type BlockProps<B> = { block: B; locale: string; ctx: BlockContext; slots?: BlockSlots }
/** Server component (sync or async) rendering one block. */
export type BlockComponent<B> = (props: BlockProps<B>) => ReactNode | Promise<ReactNode>
