import type { ReactNode } from 'react'

import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { ResolvedMotion } from '@/fields/block-motion'
import type { ResolvedAppearance } from '@/fields/block-settings'
import { anim, clipsX } from '@/lib/anim'
import { cn } from '@/lib/utils'

type ContainerSize = 'narrow' | 'content' | 'wide'

/**
 * The one wrapper every layout block renders through (server component, no client JS): theme, vertical
 * spacing, container width, anchor id and scroll-reveal live here, blocks only produce their content.
 *
 * - `container`: the block's natural container at `width: normal`; `narrow`/`wide` override it.
 * - `animate`: `container` reveals the content as one unit; `items` leaves it to the block (staggered
 *   children use `anim(i, ctx.motion)`); `none` for blocks with their own entrance (hero).
 * - `motion`: V1 preset from the render plan; without it the legacy `appearance.animation` reveal is used.
 *   Horizontal presets (slide-left/right, parallax) clip the section's x overflow (no page side-scroll).
 *   `data-anim` goes on the container, not the section, so section backgrounds never fade.
 */
export function BlockShell({
  blockType,
  appearance,
  motion,
  container,
  tone,
  animate = 'container',
  className,
  containerClassName,
  decor,
  children,
}: {
  blockType: string
  appearance: ResolvedAppearance
  motion?: ResolvedMotion
  container?: { size?: ContainerSize; className?: string }
  tone?: 'base' | 'raised'
  animate?: 'container' | 'items' | 'none'
  className?: string
  containerClassName?: string
  /** Absolutely positioned backdrop (glow/grid) rendered behind the container. */
  decor?: ReactNode
  children: ReactNode
}) {
  const size: ContainerSize =
    appearance.width === 'narrow' ? 'narrow' : appearance.width === 'wide' ? 'wide' : (container?.size ?? 'content')
  const effect = motion ?? appearance.animation
  return (
    <Section
      theme={appearance.theme}
      spacing={appearance.spacing}
      tone={tone}
      id={appearance.anchor}
      data-block={blockType}
      className={cn(appearance.anchor && 'scroll-mt-24', appearance.separator === 'top' && 'border-t border-border', motion && animate !== 'none' && clipsX(motion) && 'overflow-x-clip', className)}
    >
      {decor}
      <Container
        size={size}
        {...(animate === 'container' ? anim(0, effect, 'container') : {})}
        className={cn(decor ? 'relative' : undefined, appearance.width === 'normal' && container?.className, containerClassName)}
      >
        {children}
      </Container>
    </Section>
  )
}

/** Text alignment helper for block headings/copy. */
export const alignClass = (appearance: ResolvedAppearance) => (appearance.align === 'center' ? 'text-center' : undefined)
