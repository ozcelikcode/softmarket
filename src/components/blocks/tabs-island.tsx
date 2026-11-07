'use client'

import { useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react'

import { nextTabIndex } from '@/lib/blocks/static'
import { cn } from '@/lib/utils'

export type TabPanel = { label: string; content: ReactNode }
const subscribe = () => () => {}

/**
 * Accessible tabs (WAI-ARIA tablist, roving tabindex, automatic activation). Panels are server-rendered
 * and visible as linked sections without JS. Tab roles and hidden panels activate only after hydration.
 */
export function TabsIsland({ tabs, labelledBy }: { tabs: TabPanel[]; labelledBy?: string }) {
  const uid = useId()
  const enhanced = useSyncExternalStore(subscribe, () => true, () => false)
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const select = (i: number) => {
    setActive(i)
    refs.current[i]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(event.key, active, tabs.length)
    if (next === null) return
    event.preventDefault()
    select(next)
  }
  return (
    <div>
      <div
        role={enhanced ? 'tablist' : undefined}
        aria-orientation={enhanced ? 'horizontal' : undefined}
        aria-labelledby={labelledBy}
        aria-label={enhanced && !labelledBy ? tabs.map((tab) => tab.label).join(' / ') : undefined}
        onKeyDown={enhanced ? onKeyDown : undefined}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab, i) => enhanced ? (
          <button
            key={i}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role="tab"
            id={`${uid}-tab-${i}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => select(i)}
            className={cn(
              '-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-3 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2',
              i === active ? 'border-accent text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {tab.label}
          </button>
        ) : (
          <a key={i} id={`${uid}-tab-${i}`} href={`#${uid}-panel-${i}`} className="min-h-11 whitespace-nowrap px-4 py-3 text-small font-medium">
            {tab.label}
          </a>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={i}
          role={enhanced ? 'tabpanel' : undefined}
          id={`${uid}-panel-${i}`}
          aria-labelledby={`${uid}-tab-${i}`}
          hidden={enhanced && i !== active}
          tabIndex={0}
          className="pt-8 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {!enhanced ? <h3 className="mb-4 text-h3 font-semibold">{tab.label}</h3> : null}
          {tab.content}
        </div>
      ))}
    </div>
  )
}
