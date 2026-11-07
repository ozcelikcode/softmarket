import type { Block } from 'payload'

import { CaseStudy } from './CaseStudy'
import { CTA } from './CTA'
import { Divider } from './Divider'
import { FAQ } from './FAQ'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { LogoWall } from './LogoWall'
import { Media } from './Media'
import { MediaText } from './MediaText'
import { NewsList } from './NewsList'
import { ProductFamilies } from './ProductFamilies'
import { ProductShowcase } from './ProductShowcase'
import { RichText } from './RichText'
import { Spacer } from './Spacer'
import { SolutionsGrid } from './SolutionsGrid'
import { SpecTable } from './SpecTable'
import { Stats } from './Stats'
import { Tabs } from './Tabs'
import { Testimonial } from './Testimonial'
import { VideoEmbed } from './VideoEmbed'

export { CaseStudy, CTA, Divider, FAQ, FeatureGrid, Hero, LogoWall, Media, MediaText, NewsList, ProductFamilies, ProductShowcase, RichText, SolutionsGrid, Spacer, SpecTable, Stats, Tabs, Testimonial, VideoEmbed }

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
  Media,
  Testimonial,
  Tabs,
  Spacer,
  Divider,
  ProductFamilies,
  ProductShowcase,
  SolutionsGrid,
  CaseStudy,
  NewsList,
]
