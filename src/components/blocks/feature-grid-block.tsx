import { BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { FeatureGrid } from '@/components/sections/feature-grid'
import { SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { mediaOf } from '@/lib/content'
import type { FeatureGridBlock as Block } from '@/payload-types'

export function FeatureGridBlock({ block, ctx }: BlockProps<Block>) {
  const items = block.items ?? []
  if (!items.length) return null
  const { appearance } = ctx
  return (
    <BlockShell blockType="featureGrid" appearance={appearance} animate="items">
      {block.heading ? (
        <div {...anim(0, appearance.animation)}>
          <SectionHeading title={block.heading} lead={block.intro} align={appearance.align === 'center' ? 'center' : 'left'} className="mb-12" />
        </div>
      ) : null}
      <FeatureGrid
        columns={(Number(block.columns) || 3) as 2 | 3 | 4}
        variant={block.style === 'plain' ? 'plain' : 'cards'}
        animation={appearance.animation}
        features={items.map((it) => ({
          title: it.title,
          description: it.description ?? undefined,
          icon: mediaOf(it.image)
            ? <MediaImage media={it.image} className="size-10 rounded-md object-contain" />
            : it.icon ? <NamedIcon name={it.icon} /> : undefined,
        }))}
      />
    </BlockShell>
  )
}
