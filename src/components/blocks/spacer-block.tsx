import type { BlockProps } from '@/components/blocks/types'
import { Section } from '@/components/ui/section'
import { spacerClass } from '@/lib/blocks/static'
import { cn } from '@/lib/utils'
import type { SpacerBlock as Block } from '@/payload-types'

/** Decorative empty space; themed like any block so it blends with the neighbouring background. */
export function SpacerBlock({ block, ctx }: BlockProps<Block>) {
  const { appearance } = ctx
  return (
    <Section theme={appearance.theme} spacing="none" id={appearance.anchor} data-block="spacer" aria-hidden className={cn(appearance.anchor && 'scroll-mt-24')}>
      <div className={spacerClass(block.size)} />
    </Section>
  )
}
