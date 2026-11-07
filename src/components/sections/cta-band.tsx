import type { ReactNode } from 'react'

import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/heading'

/** Closing call-to-action band. Always dark, with a soft accent glow. */
export function CtaBand({
  title,
  lead,
  actions,
}: {
  title: ReactNode
  lead?: ReactNode
  actions: ReactNode
}) {
  return (
    <Section theme="dark" spacing="lg" className="overflow-hidden border-t border-border">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <Container size="narrow" className="relative text-center">
        <Heading as="h2" size="h1">{title}</Heading>
        {lead ? <p className="mx-auto mt-5 max-w-xl text-lead text-muted text-pretty">{lead}</p> : null}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      </Container>
    </Section>
  )
}
