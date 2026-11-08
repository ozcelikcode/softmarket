'use client'

import { ChevronDown } from 'lucide-react'
import { Accordion as AccordionPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cx } from '@/lib/cx'

export const Accordion = AccordionPrimitive.Root

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item className={cx('border-b border-border', className)} {...props} />
  )
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cx(
          'group flex flex-1 items-center justify-between gap-4 py-5 text-left text-h4 text-text',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          className="size-5 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=open]:animate-[accordion-down_200ms_ease-out]"
      {...props}
    >
      <div className={cx('pb-5 pr-9 text-muted', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
