import { CaseStudyBlock } from '@/components/blocks/case-study-block'
import { CTABlock } from '@/components/blocks/cta-block'
import { DividerBlock } from '@/components/blocks/divider-block'
import { FAQBlock } from '@/components/blocks/faq-block'
import { FeatureGridBlock } from '@/components/blocks/feature-grid-block'
import { HeroBlock } from '@/components/blocks/hero-block'
import { ListingBlock } from '@/components/blocks/listing-block'
import { LogoWallBlock } from '@/components/blocks/logo-wall-block'
import { MediaBlock } from '@/components/blocks/media-block'
import { MediaTextBlock } from '@/components/blocks/media-text-block'
import { NewsListBlock } from '@/components/blocks/news-list-block'
import { ProductFamiliesBlock } from '@/components/blocks/product-families-block'
import { ProductShowcaseBlock } from '@/components/blocks/product-showcase-block'
import { RichTextBlock } from '@/components/blocks/rich-text-block'
import { SolutionsGridBlock } from '@/components/blocks/solutions-grid-block'
import { SpacerBlock } from '@/components/blocks/spacer-block'
import { SpecTableBlock } from '@/components/blocks/spec-table-block'
import { StatsBlock } from '@/components/blocks/stats-block'
import { TabsBlock } from '@/components/blocks/tabs-block'
import { TestimonialBlock } from '@/components/blocks/testimonial-block'
import type { BlockComponent, BlockOf, LayoutBlock, LayoutBlockType } from '@/components/blocks/types'
import { VideoEmbedBlock } from '@/components/blocks/video-embed-block'

/**
 * Block type -> server component; the only place renderers are wired. The mapped type makes a missing
 * entry for any configured block a type error, and tests/unit/blocks-core.test.tsx checks parity with the
 * Payload block config at runtime.
 */
export const blockRegistry: { [K in LayoutBlockType]: BlockComponent<BlockOf<K>> } = {
  hero: HeroBlock,
  featureGrid: FeatureGridBlock,
  mediaText: MediaTextBlock,
  specTable: SpecTableBlock,
  stats: StatsBlock,
  logoWall: LogoWallBlock,
  cta: CTABlock,
  faq: FAQBlock,
  richText: RichTextBlock,
  videoEmbed: VideoEmbedBlock,
  media: MediaBlock,
  testimonial: TestimonialBlock,
  tabs: TabsBlock,
  spacer: SpacerBlock,
  divider: DividerBlock,
  productFamilies: ProductFamiliesBlock,
  productShowcase: ProductShowcaseBlock,
  solutionsGrid: SolutionsGridBlock,
  caseStudy: CaseStudyBlock,
  newsList: NewsListBlock,
  listing: ListingBlock,
}

export const hasBlockRenderer = (blockType: string): blockType is LayoutBlockType =>
  Object.prototype.hasOwnProperty.call(blockRegistry, blockType)

export const getBlockRenderer = (blockType: string): BlockComponent<LayoutBlock> | undefined =>
  hasBlockRenderer(blockType) ? (blockRegistry[blockType] as BlockComponent<LayoutBlock>) : undefined
