import type { ReactNode } from 'react'

import { Actions } from '@/components/blocks/actions'
import { ListingSection } from '@/components/blocks/listing-block'
import { RenderBlocks } from '@/components/blocks/render-blocks'
import type { LayoutBlock } from '@/components/blocks/types'
import { PageHero } from '@/components/sections/page-hero'
import type { Crumb } from '@/components/ui/breadcrumb'
import { resolveAppearance } from '@/fields/block-settings'
import type { CmsPage } from '@/lib/content'
import { publicText } from '@/lib/utils'

/*
 * System pages (F6): a fixed route (catalog, news, contact …) whose header copy and surrounding blocks come
 * from the `pages` record bound by `systemKey`. Every CMS field falls back to the i18n default when empty,
 * and without a record the route renders exactly as before.
 */

type Fallback = { title: string; lead?: string | null; eyebrow?: string | null }

/** Hero copy: CMS value when set, else the i18n default. */
export function systemHeroText(page: CmsPage | null | undefined, fallback: Fallback) {
  const hero = page?.hero
  return {
    title: publicText(hero?.title) ?? fallback.title,
    lead: publicText(hero?.lead) ?? fallback.lead ?? undefined,
    eyebrow: publicText(hero?.eyebrow) ?? fallback.eyebrow ?? undefined,
  }
}

/** SEO title/description: plugin-seo meta, then hero copy, then i18n. */
export function systemMeta(page: CmsPage | null | undefined, fallback: Fallback) {
  const text = systemHeroText(page, fallback)
  return {
    title: page?.meta?.title?.trim() || text.title,
    description: page?.meta?.description?.trim() || text.lead || undefined,
  }
}

export function SystemHero({
  locale, crumbLabel, crumbs, page, fallback, aside, className,
}: {
  locale: string
  crumbLabel: string
  crumbs: Crumb[]
  page: CmsPage | null | undefined
  fallback: Fallback
  aside?: ReactNode
  className?: string
}) {
  const text = systemHeroText(page, fallback)
  const actions = page?.hero?.actions?.length
    ? <Actions actions={page.hero.actions} locale={locale} className="mt-0" />
    : undefined
  return (
    <PageHero
      locale={locale} crumbLabel={crumbLabel} crumbs={crumbs}
      eyebrow={text.eyebrow} title={text.title} lead={text.lead} actions={actions} aside={aside} className={className}
    />
  )
}

/**
 * Body below the hero. `listing` is the route's own list (its container markup); `fallback` is what the route
 * rendered below the list before F6 (e.g. a partner CTA band), used only when no CMS record exists.
 *
 * - no record: list section + fallback (pre-F6 output)
 * - record without a `listing` block: list section first, then the blocks
 * - record with a `listing` block: blocks in order, the list at the block's position (hidden block = no list)
 */
export function SystemBody({
  locale, page, listing, fallback,
}: {
  locale: string
  page: CmsPage | null | undefined
  listing?: ReactNode
  fallback?: ReactNode
}) {
  const defaultList = listing ? <ListingSection appearance={resolveAppearance({ blockType: 'listing' })}>{listing}</ListingSection> : null
  if (!page) return <>{defaultList}{fallback}</>
  const blocks = (page.layout ?? []) as LayoutBlock[]
  const placed = blocks.some((b) => b?.blockType === 'listing')
  return (
    <>
      {placed ? null : defaultList}
      <RenderBlocks blocks={blocks} locale={locale} slots={listing ? { listing } : undefined} />
    </>
  )
}
