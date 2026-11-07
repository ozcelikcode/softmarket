import type { ReactNode } from 'react'

import { Breadcrumb, type Crumb } from '@/components/ui/breadcrumb'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { cn } from '@/lib/utils'

/** Page header with breadcrumb; support pages use the light theme. */
export function PageHero({
  locale,
  crumbLabel,
  crumbs,
  eyebrow,
  title,
  lead,
  actions,
  aside,
  className,
  theme = 'dark',
}: {
  theme?: 'dark' | 'light'
  locale: string
  crumbLabel: string
  crumbs: Crumb[]
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <Section
      theme={theme}
      spacing="none"
      className={cn(
        'overflow-hidden border-b border-border pb-14 pt-32 sm:pb-20 sm:pt-40',
        className,
      )}
    >
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
      <Container
        className={cn('relative', aside && 'grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]')}
      >
        <div>
          <Breadcrumb locale={locale} label={crumbLabel} items={crumbs} className="mb-8" />
          {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
          <Heading as="h1" size="h1" className="max-w-3xl">
            {title}
          </Heading>
          {lead ? <p className="mt-5 max-w-2xl text-lead text-muted text-pretty">{lead}</p> : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </Container>
    </Section>
  )
}
