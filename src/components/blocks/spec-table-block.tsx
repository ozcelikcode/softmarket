import { alignClass, BlockShell, editText, fieldAttrs } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { SpecTable } from '@/components/product/spec-table'
import { Heading } from '@/components/ui/heading'
import { cn } from '@/lib/utils'
import type { SpecTableBlock as Block } from '@/payload-types'

export function SpecTableBlock({ block, ctx }: BlockProps<Block>) {
  const groups = (block.groups ?? []).map((g, gi) => ({
    title: g.title ?? undefined,
    rows: (g.rows ?? []).map((r) => [r.label, r.value] as [string, string]),
    ...(ctx.edit ? { edit: {
      title: fieldAttrs(ctx, `groups.${gi}.title`),
      rows: (g.rows ?? []).map((_, ri) => [fieldAttrs(ctx, `groups.${gi}.rows.${ri}.label`), fieldAttrs(ctx, `groups.${gi}.rows.${ri}.value`)] as [Record<string, string>, Record<string, string>]),
    } } : {}),
  }))
  if (!groups.some((g) => g.rows.length)) return null
  return (
    <BlockShell blockType="specTable" appearance={ctx.appearance} motion={ctx.motion}>
      {block.heading ? <Heading size="h2" className={cn('mb-10', alignClass(ctx.appearance))}>{editText(ctx, 'heading', block.heading)}</Heading> : null}
      <SpecTable groups={groups} />
    </BlockShell>
  )
}
