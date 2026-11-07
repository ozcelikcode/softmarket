import type { Block } from 'payload'

import { CTA } from './CTA'
import { FAQ } from './FAQ'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { LogoWall } from './LogoWall'
import { MediaText } from './MediaText'
import { RichText } from './RichText'
import { SpecTable } from './SpecTable'
import { Stats } from './Stats'
import { VideoEmbed } from './VideoEmbed'

export { CTA, FAQ, FeatureGrid, Hero, LogoWall, MediaText, RichText, SpecTable, Stats, VideoEmbed }

/** Full block set for free-form pages and product bodies. */
export const layoutBlocks: Block[] = [
  Hero,
  FeatureGrid,
  MediaText,
  SpecTable,
  Stats,
  LogoWall,
  CTA,
  FAQ,
  RichText,
  VideoEmbed,
]
