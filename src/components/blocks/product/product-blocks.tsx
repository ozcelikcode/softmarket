import { ArrowDownToLine, ArrowRight, Lock } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { RichContent } from '@/components/blocks/rich-text'
import type { BlockProps } from '@/components/blocks/types'
import { EditionCard } from '@/components/product/edition-card'
import { SpecTable } from '@/components/product/spec-table'
import { FeatureGrid } from '@/components/sections/feature-grid'
import { PageHero } from '@/components/sections/page-hero'
import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Heading, SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Section } from '@/components/ui/section'
import { anim, clipsX, heroMotion } from '@/lib/anim'
import type { BlockContext } from '@/lib/blocks/render-plan'
import { PRODUCT_SECTION_IDS, isVirtualBlock, sectionHasContent, type ProductSectionId } from '@/lib/blocks/product-composition'
import { mediaOf } from '@/lib/content'
import { formatBytes } from '@/lib/format'
import { enc } from '@/lib/page-utils'
import { cn, safeHref } from '@/lib/utils'
import type {
  ProductDocsBlock,
  ProductDownloadsBlock,
  ProductEditionsBlock,
  ProductFeaturesBlock,
  ProductHeroBlock,
  ProductNavBlock,
  ProductOverviewBlock,
  ProductSpecsBlock,
} from '@/payload-types'

/*
 * V2 product-bound blocks: product page sections rendered from the product record (slot `product`, loaded once
 * by the page). Without the slot (any other page) they render nothing. The markup of every section equals the
 * pre-V2 product page; appearance (theme, spacing, alignment, separator) and motion are applied on top.
 * Virtual blocks (compatibility mode) carry no `data-block` attribute, so a legacy page's HTML is unchanged.
 */

type Bound = { id?: string | null; blockType: string }

/** Extra section props: `data-block` only on stored blocks (virtual = pre-V2 markup). */
const blockAttrs = (block: Bound) => (isVirtualBlock(block) ? {} : { 'data-block': block.blockType })
/** Section classes: fixed base + editor separator + x-clip for horizontal presets (as BlockShell). */
/** Tab-bar jump target: heading lands ~1rem under header + sticky tabs (offsets in globals.css `.product-anchor`). */
const anchor = (ctx: BlockContext, extra?: string) => cn('product-anchor', `product-anchor-${ctx.appearance.spacing ?? 'md'}`, extra)

const sectionClass = (ctx: BlockContext, base: string) =>
  cn(base, ctx.appearance.separator === 'top' && 'border-t border-border', clipsX(ctx.motion) && 'overflow-x-clip')
const headingAlign = (ctx: BlockContext) => (ctx.appearance.align === 'center' ? { align: 'center' as const } : {})

export async function ProductHeroSection({ block, locale, ctx, slots }: BlockProps<ProductHeroBlock>) {
  const data = slots?.product
  if (!data) return null
  const { product, family, productSlug, path, trail } = data
  const [t, c] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'common' }),
  ])
  const brochure = mediaOf(product.brochure)
  // Always LCP-protected (render plan): heading/lead only translate; `parallax-soft` moves the hero image.
  const parallax = ctx.motion.preset === 'parallax-soft' ? anim(0, ctx.motion) : null
  return (
    <PageHero
      locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} theme={ctx.appearance.theme}
      eyebrow={family.title} title={product.title} lead={product.tagline ?? product.summary}
      enter={isVirtualBlock(block) ? undefined : heroMotion(ctx.motion)}
      asideMotion={parallax}
      className={ctx.appearance.separator === 'top' ? 'border-t' : undefined}
      actions={
        <>
          {/* Required primary action ("Teklif İste"), on every product page. */}
          <Button asChild size="lg"><AppLink href={`/teklif-iste?urun=${enc(productSlug)}`} locale={locale}>{t('quote')}</AppLink></Button>
          <Button asChild size="lg" variant="secondary"><AppLink href={`${path}#surumler`} locale={locale}>{t('editions')}</AppLink></Button>
          {brochure && safeHref(brochure.url) ? (
            <Button asChild size="lg" variant="ghost"><a href={brochure.url!} download>{t('brochure')}<ArrowDownToLine aria-hidden /></a></Button>
          ) : null}
        </>
      }
      aside={mediaOf(product.heroImage) ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
          <MediaImage media={product.heroImage} priority sizes="(min-width: 1024px) 45vw, 100vw" className="aspect-[16/10] rounded-lg" />
        </div>
      ) : undefined}
    />
  )
}

const NAV_LABEL: Record<ProductSectionId, string> = {
  'genel-bakis': 'overview',
  ozellikler: 'features',
  'teknik-ozellikler': 'specs',
  surumler: 'editions',
  indirmeler: 'downloads',
  dokumantasyon: 'docs',
}

/** Sticky section tabs; links follow the visible sections in page order. */
export async function ProductNavSection({ block, locale, ctx, slots }: BlockProps<ProductNavBlock>) {
  const data = slots?.product
  if (!data || !data.sections.length) return null
  const t = await getTranslations({ locale, namespace: 'product' })
  return (
    <Section theme={ctx.appearance.theme} spacing="none" {...blockAttrs(block)} className={sectionClass(ctx, 'sticky top-16 z-30 border-b border-border bg-surface/90 backdrop-blur lg:top-[4.5rem]')}>
      <Container {...anim(0, ctx.motion, 'container')}>
        <div className="relative">
        <nav aria-label={t('nav')} className="-mx-1 flex gap-1 overflow-x-auto pr-8 [scrollbar-width:none] lg:pr-0 [&::-webkit-scrollbar]:hidden">
          {data.sections.map((id) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-md px-3 py-3 text-small font-medium text-muted transition-colors hover:text-text">
              {t(NAV_LABEL[id])}
            </a>
          ))}
        </nav>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent lg:hidden" />
        </div>
      </Container>
    </Section>
  )
}

export function ProductOverviewSection({ block, ctx, slots }: BlockProps<ProductOverviewBlock>) {
  const summary = slots?.product?.product.summary
  if (!summary) return null
  return (
    <div id={PRODUCT_SECTION_IDS.productOverview} className={anchor(ctx)}>
      <Section theme={ctx.appearance.theme} spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, '') || undefined}>
        <Container {...anim(0, ctx.motion, 'container')}><p className={cn('max-w-3xl text-h3 font-normal text-text text-pretty', ctx.appearance.align === 'center' && 'mx-auto text-center')}>{summary}</p></Container>
      </Section>
    </div>
  )
}

export async function ProductFeaturesSection({ block, locale, ctx, slots }: BlockProps<ProductFeaturesBlock>) {
  const features = slots?.product?.product.features ?? []
  if (!features.length) return null
  const t = await getTranslations({ locale, namespace: 'product' })
  return (
    <Section id={PRODUCT_SECTION_IDS.productFeatures} theme={ctx.appearance.theme} tone="raised" spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, anchor(ctx))}>
      <Container>
        <SectionHeading title={t('features')} className="mb-10" {...headingAlign(ctx)} />
        {/* Item reveal (pre-V2: subtle per card); the block's motion drives it. */}
        <FeatureGrid animation={ctx.motion} features={features.map((f) => ({ title: f.title, description: f.description ?? undefined, icon: f.icon ? <NamedIcon name={f.icon} /> : undefined }))} />
      </Container>
    </Section>
  )
}

export async function ProductSpecsSection({ block, locale, ctx, slots }: BlockProps<ProductSpecsBlock>) {
  const data = slots?.product
  if (!data) return null
  const specs = data.product.specs ?? []
  const requirements = (data.product.systemRequirements ?? []).filter((r) => r.minimum || r.recommended)
  const content = { summary: false, features: false, specs: specs.length > 0, requirements: requirements.length > 0 }
  if (!sectionHasContent(block, content)) return null
  const showRequirements = block.showRequirements !== false && requirements.length > 0
  const [t, os] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'os' }),
  ])
  const groups = new Map<string, [string, string][]>()
  for (const s of specs) {
    const k = s.group ?? ''
    groups.set(k, [...(groups.get(k) ?? []), [s.label, s.value]])
  }
  return (
    <Section id={PRODUCT_SECTION_IDS.productSpecs} theme={ctx.appearance.theme} spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, anchor(ctx))}>
      <Container className="space-y-16" {...anim(0, ctx.motion, 'container')}>
        {specs.length ? (
          <div>
            <SectionHeading title={t('specs')} className="mb-10" {...headingAlign(ctx)} />
            <SpecTable groups={[...groups].map(([title, rows]) => ({ title: title || undefined, rows }))} />
          </div>
        ) : null}
        {showRequirements ? (
          <div>
            <SectionHeading title={t('requirements')} className="mb-10" {...headingAlign(ctx)} />
            <div className={cn('grid gap-5', requirements.length > 1 && 'md:grid-cols-2')}>
              {requirements.map((r, i) => (
                <div key={r.id ?? i} className="rounded-lg border border-border bg-surface p-6">
                  <Badge variant="accent">{os(r.os)}</Badge>
                  {r.minimum ? <div className="mt-5"><p className="mb-2 text-eyebrow font-semibold uppercase text-muted">{t('minimum')}</p><RichContent data={r.minimum} locale={locale} className="text-small" /></div> : null}
                  {r.recommended ? <div className="mt-5"><p className="mb-2 text-eyebrow font-semibold uppercase text-muted">{t('recommended')}</p><RichContent data={r.recommended} locale={locale} className="text-small" /></div> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </Section>
  )
}

/**
 * Editions + "Teklif İste" (required block, never hidden). Every card links to `/teklif-iste?urun=…&surum=<SKU>`;
 * without editions the product-level quote action is shown. A future purchase mode (docs/plan-payments.md) adds
 * a second action per card; the quote action stays.
 */
export async function ProductEditionsSection({ block, locale, ctx, slots }: BlockProps<ProductEditionsBlock>) {
  const data = slots?.product
  if (!data) return null
  const { editions, productSlug } = data
  const t = await getTranslations({ locale, namespace: 'product' })
  return (
    <Section id={PRODUCT_SECTION_IDS.productEditions} theme={ctx.appearance.theme} spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, anchor(ctx, 'overflow-hidden border-y border-border'))}>
      <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
      <Container className="relative" {...anim(0, ctx.motion, 'container')}>
        <SectionHeading title={t('editions')} className="mb-12" {...headingAlign(ctx)} />
        {editions.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {editions.map((e) => <EditionCard key={e.id} edition={e} productSlug={productSlug} locale={locale} />)}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border-strong/60 p-10 text-center">
            <p className="text-muted">{t('editionsEmpty')}</p>
            <Button asChild className="mt-6"><AppLink href={`/teklif-iste?urun=${enc(productSlug)}`} locale={locale}>{t('quote')}</AppLink></Button>
          </div>
        )}
      </Container>
    </Section>
  )
}

export async function ProductDownloadsSection({ block, locale, ctx, slots }: BlockProps<ProductDownloadsBlock>) {
  const data = slots?.product
  if (!data) return null
  const { downloads } = data
  const [t, os] = await Promise.all([
    getTranslations({ locale, namespace: 'product' }),
    getTranslations({ locale, namespace: 'os' }),
  ])
  return (
    <Section id={PRODUCT_SECTION_IDS.productDownloads} theme={ctx.appearance.theme} spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, anchor(ctx))}>
      <Container {...anim(0, ctx.motion, 'container')}>
        <SectionHeading title={t('downloads')} className="mb-10" {...headingAlign(ctx)} />
        {downloads.length ? (
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {downloads.map((d) => {
              const file = mediaOf(d.file) as { url?: string | null; filesize?: number | null } | null
              const href = safeHref(file?.url)
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-text">{d.title}</p>
                    <p className="mt-0.5 text-small text-muted">
                      {[os(d.os), d.arch, formatBytes((d.file as { filesize?: number | null })?.filesize)].filter(Boolean).join(' · ')}
                    </p>
                    {d.checksumSha256 ? <p className="mt-1 break-all font-mono text-xs text-muted">{t('checksum')}: {d.checksumSha256}</p> : null}
                  </div>
                  {href ? (
                    <Button asChild variant="secondary" size="sm"><a href={href} download>{t('download')}<ArrowDownToLine aria-hidden /></a></Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted">{t('noDownloads')}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-5 py-4">
          <Lock aria-hidden className="size-4 text-muted" />
          <p className="flex-1 text-small text-muted"><span className="font-medium text-text">{t('licenseRequired')}.</span> {t('licensedNote')}</p>
          <Button asChild variant="link"><AppLink href="/hesap/indirmeler" locale={locale}>{t('portal')}<ArrowRight aria-hidden /></AppLink></Button>
        </div>
      </Container>
    </Section>
  )
}

export async function ProductDocsSection({ block, locale, ctx, slots }: BlockProps<ProductDocsBlock>) {
  const data = slots?.product
  if (!data) return null
  const t = await getTranslations({ locale, namespace: 'product' })
  const docsHref = data.docSlug ? `/destek/dokumantasyon/${enc(data.productSlug)}/${enc(data.docSlug)}` : '/destek/dokumantasyon'
  return (
    <Section id={PRODUCT_SECTION_IDS.productDocs} theme={ctx.appearance.theme} tone="raised" spacing={ctx.appearance.spacing} {...blockAttrs(block)} className={sectionClass(ctx, anchor(ctx, 'border-t border-border'))}>
      <Container className={cn('flex flex-wrap items-center justify-between gap-6', ctx.appearance.align === 'center' && 'flex-col text-center')} {...anim(0, ctx.motion, 'container')}>
        <div>
          <Heading size="h3">{t('docs')}</Heading>
          <p className="mt-2 text-muted">{t('docsLead')}</p>
        </div>
        <Button asChild variant="secondary" size="lg"><AppLink href={docsHref} locale={locale}>{t('openDocs')}<ArrowRight aria-hidden /></AppLink></Button>
      </Container>
    </Section>
  )
}
