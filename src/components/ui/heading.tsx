import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn('text-eyebrow font-semibold uppercase text-accent', className)}
      {...props}
    />
  )
}

const headingVariants = cva('text-balance text-text', {
  variants: {
    size: {
      display: 'text-display',
      h1: 'text-h1',
      h2: 'text-h2',
      h3: 'text-h3',
      h4: 'text-h4',
    },
  },
  defaultVariants: { size: 'h2' },
})

type HeadingProps = ComponentProps<'h2'> &
  VariantProps<typeof headingVariants> & { as?: 'h1' | 'h2' | 'h3' | 'h4' }

export function Heading({ as, size, className, ...props }: HeadingProps) {
  const Tag = as ?? (size === 'display' ? 'h1' : (size ?? 'h2'))
  return <Tag className={cn(headingVariants({ size }), className)} {...props} />
}

type SectionHeadingProps = {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  size?: 'display' | 'h1' | 'h2'
  align?: 'left' | 'center'
  className?: string
}

/** Eyebrow + heading + lead block used at the top of sections. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  size = 'h2',
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      <Heading size={size}>{title}</Heading>
      {lead ? <p className="mt-5 text-lead text-muted text-pretty">{lead}</p> : null}
    </div>
  )
}
