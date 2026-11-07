import { Actions } from '@/components/blocks/actions'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { HeroBlock as Block } from '@/payload-types'

export function HeroBlock({ block, locale }: { block: Block; locale: string }) {
  const variant = block.variant ?? 'default'
  const hasMedia = Boolean(mediaOf(block.media))
  const split = variant === 'split' && hasMedia
  return (
    <Section theme="dark" spacing="lg" className="overflow-hidden">
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <Container className={cn('relative', split && 'grid items-center gap-12 lg:grid-cols-2', variant === 'centered' && 'text-center')}>
        <div className={cn(variant === 'centered' && 'mx-auto max-w-3xl')}>
          {block.eyebrow ? <Eyebrow className="mb-4">{block.eyebrow}</Eyebrow> : null}
          <Heading as="h2" size="h1">{block.heading}</Heading>
          {block.subheading ? <p className={cn('mt-5 max-w-2xl text-lead text-muted text-pretty', variant === 'centered' && 'mx-auto')}>{block.subheading}</p> : null}
          <div className={cn(variant === 'centered' && '[&>div]:justify-center')}>
            <Actions actions={block.actions} locale={locale} />
          </div>
        </div>
        {hasMedia ? (
          <div className={cn('overflow-hidden rounded-xl border border-border bg-surface', !split && 'mt-14')}>
            <MediaImage media={block.media} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[16/10]" />
          </div>
        ) : null}
      </Container>
    </Section>
  )
}
