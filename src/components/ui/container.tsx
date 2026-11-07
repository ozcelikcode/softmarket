import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

const containerVariants = cva('mx-auto w-full px-5 sm:px-8', {
  variants: {
    size: { narrow: 'max-w-narrow', content: 'max-w-content', wide: 'max-w-wide' },
  },
  defaultVariants: { size: 'content' },
})

type Props = ComponentProps<'div'> & VariantProps<typeof containerVariants>

export function Container({ className, size, ...props }: Props) {
  return <div className={cn(containerVariants({ size }), className)} {...props} />
}
