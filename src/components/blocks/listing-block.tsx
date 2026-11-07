import type { ReactNode } from 'react'

import type { BlockProps } from '@/components/blocks/types'
import { Section } from '@/components/ui/section'
import type { ResolvedAppearance } from '@/fields/block-settings'
import { cn } from '@/lib/utils'
import type { ListingBlock as Block } from '@/payload-types'

/**
 * Section around a system page's own list (catalog, news, partners …). The list keeps its own container and
 * item animation; theme, spacing, anchor and separator come from the `listing` block (defaults: light, md,
 * i.e. the pre-F6 list section).
 */
export function ListingSection({ appearance, children }: { appearance: ResolvedAppearance; children: ReactNode }) {
  return (
    <Section
      theme={appearance.theme}
      spacing={appearance.spacing}
      id={appearance.anchor}
      data-block="listing"
      className={cn(appearance.anchor && 'scroll-mt-24', appearance.separator === 'top' && 'border-t border-border')}
    >
      {children}
    </Section>
  )
}

/** `listing` block: renders the route's list passed in by the page (slot); nothing on other pages. */
export function ListingBlock({ ctx, slots }: BlockProps<Block>) {
  return slots?.listing ? <ListingSection appearance={ctx.appearance}>{slots.listing}</ListingSection> : null
}
