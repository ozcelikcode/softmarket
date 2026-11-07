import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-surface-2 text-muted',
        accent: 'border-accent/40 bg-accent/10 text-accent',
        success: 'border-success/40 bg-success/10 text-success',
        warning: 'border-warning/40 bg-warning/10 text-warning',
        danger: 'border-danger/40 bg-danger/10 text-danger',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

type Props = ComponentProps<'span'> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: Props) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
