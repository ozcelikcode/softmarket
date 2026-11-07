import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast hover:bg-accent-hover',
        secondary: 'border border-border-strong bg-transparent text-text hover:bg-surface-2',
        ghost: 'text-text hover:bg-surface-2',
        link: 'h-auto rounded-sm p-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3.5 text-small',
        md: 'h-11 px-5 text-small',
        lg: 'h-12 px-6 text-body',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type Props = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
