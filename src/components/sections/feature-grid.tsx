import type { ReactNode } from 'react'

import { anim } from '@/lib/anim'
import { cn } from '@/lib/utils'

export type Feature = { icon?: ReactNode; title: string; description?: string }

/** Column count follows the item count so the last row never leaves empty cells (4 items = 2x2 / 4x1, never 3+1). */
function gridCols(count: number, columns: 2 | 3 | 4) {
  if (count <= 1) return ''
  if (count === 2) return 'sm:grid-cols-2'
  if (count === 4) return 'sm:grid-cols-2 lg:grid-cols-4'
  return { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns]
}

export function FeatureGrid({
  features,
  columns = 3,
  className,
}: {
  features: Feature[]
  columns?: 2 | 3 | 4
  className?: string
}) {
  return (
    <ul className={cn('grid gap-4', gridCols(features.length, columns), className)}>
      {features.map((f, i) => (
        <li key={f.title}>
          <div {...anim(i % 3)} className="card-hover h-full rounded-lg border border-border bg-surface p-7">
            {f.icon ? (
              <span className="mb-5 inline-flex text-accent [&_svg]:size-6">{f.icon}</span>
            ) : null}
            <h3 className="text-h4 text-text">{f.title}</h3>
            {f.description ? <p className="mt-2 text-small text-muted">{f.description}</p> : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
