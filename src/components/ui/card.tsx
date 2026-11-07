import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export function Card({
  className,
  interactive,
  ...props
}: ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-6',
        interactive &&
          'transition-colors duration-200 hover:border-border-strong hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  )
}

export const CardTitle = ({ className, ...props }: ComponentProps<'h3'>) => (
  <h3 className={cn('text-h4 text-text', className)} {...props} />
)

export const CardDescription = ({ className, ...props }: ComponentProps<'p'>) => (
  <p className={cn('mt-2 text-small text-muted', className)} {...props} />
)
