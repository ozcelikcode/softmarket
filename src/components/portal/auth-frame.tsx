import type { ReactNode } from 'react'

import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'

/** Centered card for the anonymous account pages. */
export function AuthFrame({
  title,
  lead,
  children,
  footer,
}: {
  title: string
  lead?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Section theme="light" spacing="none" className="min-h-[85vh] pb-20 pt-32 sm:pt-40">
      <Container size="narrow" className="max-w-md">
        <Heading as="h1" size="h2">
          {title}
        </Heading>
        {lead ? <p className="mt-3 text-muted text-pretty">{lead}</p> : null}
        <div className="mt-8 rounded-lg border border-border bg-surface p-6 sm:p-8">{children}</div>
        {footer ? <div className="mt-6 text-small text-muted">{footer}</div> : null}
      </Container>
    </Section>
  )
}
