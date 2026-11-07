import type { ReactNode } from 'react'

import { Heading } from '@/components/ui/heading'

export function PortalHeading({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <Heading as="h1" size="h2">
          {title}
        </Heading>
        {lead ? <p className="mt-2 text-muted text-pretty">{lead}</p> : null}
      </div>
      {actions}
    </div>
  )
}
