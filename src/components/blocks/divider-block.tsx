import { BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { cn } from '@/lib/utils'
import type { DividerBlock as Block } from '@/payload-types'

export function DividerBlock({ block, ctx }: BlockProps<Block>) {
  const accent = block.style === 'accent'
  return (
    <BlockShell blockType="divider" appearance={ctx.appearance} animate="none">
      <hr className={cn('border-0', accent ? 'mx-auto h-0.5 w-16 rounded-full bg-accent' : 'h-px bg-border')} />
    </BlockShell>
  )
}
