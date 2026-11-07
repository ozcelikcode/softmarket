import { CTABlock } from '@/components/blocks/cta-block'
import { FAQBlock } from '@/components/blocks/faq-block'
import { FeatureGridBlock } from '@/components/blocks/feature-grid-block'
import { HeroBlock } from '@/components/blocks/hero-block'
import { LogoWallBlock } from '@/components/blocks/logo-wall-block'
import { MediaTextBlock } from '@/components/blocks/media-text-block'
import { RichTextBlock } from '@/components/blocks/rich-text-block'
import { SpecTableBlock } from '@/components/blocks/spec-table-block'
import { StatsBlock } from '@/components/blocks/stats-block'
import { VideoEmbedBlock } from '@/components/blocks/video-embed-block'
import type { Page } from '@/payload-types'

export type LayoutBlock = NonNullable<Page['layout']>[number]

/** Renders a Payload `layout` field. Unknown block types are skipped, never thrown on. */
export function RenderBlocks({ blocks, locale }: { blocks?: LayoutBlock[] | null; locale: string }) {
  if (!blocks?.length) return null
  return (
    <>
      {blocks.map((block, i) => {
        const key = block.id ?? `${block.blockType}-${i}`
        switch (block.blockType) {
          case 'hero': return <HeroBlock key={key} block={block} locale={locale} />
          case 'featureGrid': return <FeatureGridBlock key={key} block={block} />
          case 'mediaText': return <MediaTextBlock key={key} block={block} locale={locale} />
          case 'specTable': return <SpecTableBlock key={key} block={block} />
          case 'stats': return <StatsBlock key={key} block={block} />
          case 'logoWall': return <LogoWallBlock key={key} block={block} />
          case 'cta': return <CTABlock key={key} block={block} locale={locale} />
          case 'faq': return <FAQBlock key={key} block={block} locale={locale} />
          case 'richText': return <RichTextBlock key={key} block={block} locale={locale} />
          case 'videoEmbed': return <VideoEmbedBlock key={key} block={block} />
          default: return null
        }
      })}
    </>
  )
}
