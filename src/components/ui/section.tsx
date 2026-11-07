import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const sectionVariants = cva('relative w-full bg-bg text-text', {
  variants: {
    spacing: {
      none: '',
      sm: 'py-12 sm:py-16',
      md: 'py-16 sm:py-24',
      lg: 'py-24 sm:py-32',
    },
    tone: { base: '', raised: 'bg-surface' },
  },
  defaultVariants: { spacing: 'md', tone: 'base' },
})

type Props = ComponentProps<'section'> &
  VariantProps<typeof sectionVariants> & { theme?: 'dark' | 'light' }

/** Page section. `theme` swaps all color tokens for its subtree via data-theme. */
export function Section({ theme = 'dark', spacing, tone, className, ...props }: Props) {
  return (
    <section
      data-theme={theme}
      className={cn(sectionVariants({ spacing, tone }), className)}
      {...props}
    />
  )
}
