import { RenderBlocks } from '@/components/blocks/render-blocks'
import { hasBlockRenderer } from '@/components/blocks/registry'
import type { LayoutBlock } from '@/components/blocks/types'
import { PageHero } from '@/components/sections/page-hero'
import type { Crumb } from '@/components/ui/breadcrumb'
import type { CmsPage } from '@/lib/content'
import { planBlocks } from '@/lib/blocks/render-plan'

/** Blocks of a home/landing page. `listing` only has meaning on system pages and is dropped here. */
export function pageBlocksOf(page: Pick<CmsPage, 'layout'>): LayoutBlock[] {
  return ((page.layout ?? []) as LayoutBlock[]).filter((b) => b && b.blockType !== 'listing')
}

/** Whether the first rendered block is a hero (it then becomes the page's h1 and clears the fixed header). */
export function startsWithHero(blocks: readonly LayoutBlock[]): boolean {
  return planBlocks(blocks, { isKnown: hasBlockRenderer })[0]?.block.blockType === 'hero'
}

/**
 * Body of a CMS-driven page (home, landing). A page that opens with a hero renders it as the h1 under the
 * fixed header; otherwise a PageHero with the page title supplies the h1 and the header clearance.
 */
export function CmsPageContent({
  page, locale, crumbLabel, crumbs = [],
}: {
  page: Pick<CmsPage, 'title' | 'layout'>
  locale: string
  crumbLabel: string
  crumbs?: Crumb[]
}) {
  const blocks = pageBlocksOf(page)
  if (startsWithHero(blocks)) return <RenderBlocks blocks={blocks} locale={locale} firstHeroH1 />
  return (
    <>
      <PageHero locale={locale} crumbLabel={crumbLabel} crumbs={crumbs} title={page.title} />
      <RenderBlocks blocks={blocks} locale={locale} />
    </>
  )
}
