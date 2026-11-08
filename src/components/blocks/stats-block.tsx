import { BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { cn } from '@/lib/utils'
import type { StatsBlock as Block } from '@/payload-types'

export function StatsBlock({ block, ctx }: BlockProps<Block>) {
  const items = block.items ?? []
  if (!items.length) return null
  const center = ctx.appearance.align === 'center'
  return (
    <BlockShell blockType="stats" appearance={ctx.appearance} motion={ctx.motion} className="border-y border-border">
      {block.heading ? <Heading size="h2" className={cn('mb-12 max-w-2xl', center && 'mx-auto text-center')}>{block.heading}</Heading> : null}
      <dl className={`grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 ${items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {items.map((it, i) => (
          <div key={it.id ?? i} className={cn('bg-surface p-7', center && 'text-center')}>
            <dd className="font-mono text-display leading-none text-text [font-size:clamp(2rem,1.4rem+2vw,3.25rem)]">{it.value}</dd>
            <dt className="mt-3 text-h4 text-text">{it.label}</dt>
            {it.description ? <p className="mt-1 text-small text-muted">{it.description}</p> : null}
          </div>
        ))}
      </dl>
    </BlockShell>
  )
}
