import { NamedIcon } from '@/components/ui/icon'
import { FeatureGrid } from '@/components/sections/feature-grid'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { mediaOf } from '@/lib/content'
import type { FeatureGridBlock as Block } from '@/payload-types'

export function FeatureGridBlock({ block }: { block: Block }) {
  const items = block.items ?? []
  if (!items.length) return null
  return (
    <Section theme="light" spacing="md">
      <Container>
        {block.heading ? <SectionHeading title={block.heading} lead={block.intro} className="mb-12" /> : null}
        <FeatureGrid
          columns={(Number(block.columns) || 3) as 2 | 3 | 4}
          features={items.map((it) => ({
            title: it.title,
            description: it.description ?? undefined,
            icon: mediaOf(it.image)
              ? <MediaImage media={it.image} className="size-10 rounded-md object-contain" />
              : it.icon ? <NamedIcon name={it.icon} /> : undefined,
          }))}
        />
      </Container>
    </Section>
  )
}
