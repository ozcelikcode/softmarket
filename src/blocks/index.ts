import type { Block } from 'payload'

import { CaseStudy } from './CaseStudy'
import { CTA } from './CTA'
import { Divider } from './Divider'
import { FAQ } from './FAQ'
import { FeatureGrid } from './FeatureGrid'
import { Hero } from './Hero'
import { Listing } from './Listing'
import { LogoWall } from './LogoWall'
import { Media } from './Media'
import { MediaText } from './MediaText'
import { NewsList } from './NewsList'
import { ProductFamilies } from './ProductFamilies'
import { productBoundBlocks } from './product-bound'
import { ProductShowcase } from './ProductShowcase'
import { RichText } from './RichText'
import { Spacer } from './Spacer'
import { SolutionsGrid } from './SolutionsGrid'
import { SpecTable } from './SpecTable'
import { Stats } from './Stats'
import { Tabs } from './Tabs'
import { Testimonial } from './Testimonial'
import { VideoEmbed } from './VideoEmbed'

export { CaseStudy, CTA, Divider, FAQ, FeatureGrid, Hero, Listing, LogoWall, Media, MediaText, NewsList, ProductFamilies, ProductShowcase, RichText, SolutionsGrid, Spacer, SpecTable, Stats, Tabs, Testimonial, VideoEmbed }

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

/** Pages add the system-page list position (F6). Only appended: removing a block drops its tables. */
export const pageBlocks: Block[] = [...layoutBlocks, Listing]

/**
 * Products (V2): the full set plus the product-bound sections (hero, tabs, overview, features, specs,
 * editions + quote, downloads, docs). Only `products.layout` creates tables for them.
 */
export const productBlocks: Block[] = [...layoutBlocks, ...productBoundBlocks]
export { productBoundBlocks }
