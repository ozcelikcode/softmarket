import type { ReactNode } from 'react'

import { Breadcrumb, type Crumb } from '@/components/ui/breadcrumb'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { heroIn } from '@/lib/anim'
import { cn } from '@/lib/utils'

/** Page header with breadcrumb. Dark by default: every title page shares one hero theme. */
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
        className={cn('relative', aside && 'grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.2fr_1fr]')}
      >
        <div className="min-w-0">
          <Breadcrumb locale={locale} label={crumbLabel} items={crumbs} className="mb-10" />
          {eyebrow ? <Eyebrow className="mb-5" {...heroIn(0)}>{eyebrow}</Eyebrow> : null}
          <Heading as="h1" size="h1" className="max-w-3xl" {...heroIn(1, 'slide')}>
            {title}
          </Heading>
          {lead ? <p className="mt-5 max-w-2xl text-lead text-muted text-pretty break-words" {...heroIn(2, 'slide')}>{lead}</p> : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3" {...heroIn(3)}>{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0" {...heroIn(4, 'slide')}>{aside}</div> : null}
      </Container>
    </Section>
  )
}
