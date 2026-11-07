import { Actions } from '@/components/blocks/actions'
import { RichContent } from '@/components/blocks/rich-text'
import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { MediaTextBlock as Block } from '@/payload-types'

export function MediaTextBlock({ block, locale }: { block: Block; locale: string }) {
  const hasMedia = Boolean(mediaOf(block.media))
  return (
    <Section theme="light" tone="raised" spacing="md">
      <Container className={cn('grid items-center gap-12', hasMedia && 'lg:grid-cols-2')}>
        {hasMedia ? (
          <div className={cn('overflow-hidden rounded-xl border border-border bg-bg', block.mediaPosition === 'right' && 'lg:order-2')}>
            <MediaImage media={block.media} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/3]" />
          </div>
        ) : null}
        <div>
          {block.heading ? <Heading size="h2">{block.heading}</Heading> : null}
          {block.body ? <RichContent data={block.body} locale={locale} className="mt-5" /> : null}
          <Actions actions={block.actions} locale={locale} />
        </div>
      </Container>
    </Section>
  )
}
