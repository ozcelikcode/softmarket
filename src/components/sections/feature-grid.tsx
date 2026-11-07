import type { ReactNode } from 'react'

import { Reveal } from '@/components/ui/reveal'
import { cn } from '@/lib/utils'

export type Feature = { icon?: ReactNode; title: string; description?: string }

export function FeatureGrid({
  features,
  columns = 3,
  className,
}: {
  features: Feature[]
  columns?: 2 | 3 | 4
  className?: string
}) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns]
  return (
    <ul className={cn('grid gap-px overflow-hidden rounded-lg border border-border bg-border', cols, className)}>
      {features.map((f, i) => (
        <li key={f.title} className="bg-surface">
          <Reveal delay={Math.min(i, 5) * 0.05} className="h-full p-7">
            {f.icon ? (
              <span className="mb-5 inline-flex text-accent [&_svg]:size-6">{f.icon}</span>
            ) : null}
            <h3 className="text-h4 text-text">{f.title}</h3>
            {f.description ? <p className="mt-2 text-small text-muted">{f.description}</p> : null}
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
