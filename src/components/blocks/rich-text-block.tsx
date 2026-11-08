import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import { RichContent } from '@/components/blocks/rich-text'
import type { BlockProps } from '@/components/blocks/types'
import type { RichTextBlock as Block } from '@/payload-types'

/** The block's own `width` field (text measure) predates F3; its appearance group has no width option. */
export function RichTextBlock({ block, locale, ctx }: BlockProps<Block>) {
  return (
    <BlockShell
      blockType="richText"
      appearance={ctx.appearance}
      motion={ctx.motion}
      container={{ size: block.width === 'wide' ? 'content' : 'narrow', className: block.width === 'normal' || !block.width ? 'max-w-[52rem]' : undefined }}
    >
      <RichContent data={block.content} locale={locale} className={alignClass(ctx.appearance)} />
    </BlockShell>
  )
}
