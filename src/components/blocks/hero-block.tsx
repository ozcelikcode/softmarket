import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { Actions } from '@/components/blocks/actions'
import { BlockShell } from '@/components/blocks/block-shell'
import { HeroVideo } from '@/components/blocks/hero-video'
import type { BlockProps } from '@/components/blocks/types'
import { AppLink } from '@/components/ui/app-link'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { heroIn } from '@/lib/anim'
import { HERO_PANEL_FAMILIES, loadHeroFamilies } from '@/lib/blocks/data'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { HeroBlock as Block } from '@/payload-types'

export type HeroVariant = 'cinematic' | 'split' | 'centered' | 'minimal' | 'mediaBackground'

/** Stored value -> layout. `default` (and anything unknown/legacy) is the cinematic layout. */
export function heroVariant(value: Block['variant']): HeroVariant {
  return value === 'split' || value === 'centered' || value === 'minimal' || value === 'mediaBackground' ? value : 'cinematic'
}

/**
 * Framed product family list (the pre-F6 home hero panel): first published families with product counts,
 * a skeleton + "catalog coming" note when there are none.
 */
async function FamiliesPanel({ locale, title }: { locale: string; title?: string | null }) {
  const [{ docs, counts }, t] = await Promise.all([loadHeroFamilies(locale), getTranslations({ locale, namespace: 'home' })])
  const families = docs.slice(0, HERO_PANEL_FAMILIES)
  return (
    <div className="w-full max-w-full rounded-xl border border-border bg-surface p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
      <div className="rounded-lg border border-border bg-bg p-5">
        <div className="flex items-center justify-between">
          <div aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border-strong" /><span className="size-2.5 rounded-full bg-border-strong" /><span className="size-2.5 rounded-full bg-border-strong" />
          </div>
          <span className="font-mono text-xs text-muted">{title?.trim() || t('panelTitle')}</span>
        </div>
        <ul className="mt-5 space-y-2">
          {families.length ? families.map((f) => (
            <li key={f.id}>
              <AppLink href={`/urunler/${encodeURIComponent(f.slug!)}`} locale={locale} className="group flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-2">
                <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-bg text-accent"><NamedIcon name={f.icon} className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-medium text-text">{f.title}</span>
                  {f.tagline ? <span className="block truncate text-xs text-muted">{f.tagline}</span> : null}
                </span>
                <span className="font-mono text-xs text-muted">{counts.get(f.id) ?? 0}</span>
                <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </AppLink>
            </li>
          )) : [88, 64, 76, 52].map((w, i) => (
            <li key={i} aria-hidden className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3">
              <span className="size-9 rounded-md border border-border bg-bg" />
              <span className="flex-1 space-y-2"><span className="block h-1.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} /><span className="block h-1.5 w-1/3 rounded-full bg-surface-2" /></span>
            </li>
          ))}
        </ul>
        {!families.length ? <p className="mt-4 text-center text-xs text-muted">{t('panelEmpty')}</p> : null}
      </div>
    </div>
  )
}

/**
 * Hero variants: cinematic (glow + grid, display heading, framed media on the right), split (equal
 * columns), centered (media below) and minimal (no decoration). Heading level comes from the page plan
 * (first hero on a CMS-driven page = h1). Entrance uses the CSS-only hero keyframes; title/lead only slide.
 */
export function HeroBlock({ block, locale, ctx }: BlockProps<Block>) {
  const { appearance } = ctx
  const variant = heroVariant(block.variant)
  const sideCapable = variant === 'cinematic' || variant === 'split'
  const familiesPanel = sideCapable && block.aside === 'families'
  const hasMedia = !familiesPanel && Boolean(mediaOf(block.media)) && variant !== 'mediaBackground'
  const sideMedia = familiesPanel || (hasMedia && sideCapable)
  const cinematic = variant === 'cinematic'
  const center = variant === 'centered' || appearance.align === 'center'
  const bgPoster = variant === 'mediaBackground' ? mediaOf(block.media) : null
  const video = mediaOf(block.video)
  const bgVideo = bgPoster && video?.protected === false && video.visibility === 'public'
    && (video.mimeType === 'video/mp4' || video.mimeType === 'video/webm') ? video.url : undefined
  const motion = appearance.animation !== 'none'
  const enter = (i: number, mode?: 'fade' | 'slide') => (motion ? heroIn(i, mode) : {})
  return (
    <BlockShell
      blockType="hero"
      appearance={appearance}
      animate="none"
      // Page top (CMS page/home): clear the fixed header. Default spacing reproduces the pre-F6 home hero
      // (pt-40/48, pb-20/28); other spacings keep their own bottom padding.
      className={cn('overflow-hidden', ctx.pageTop && 'pt-40 sm:pt-48', ctx.pageTop && appearance.spacing === 'lg' && 'pb-20 sm:pb-28', variant === 'mediaBackground' && 'flex min-h-[32rem] items-center sm:min-h-[40rem]')}
      decor={variant === 'mediaBackground' ? (
        <>
          {/* Poster = LCP image (server-rendered, priority). The video mounts only on desktop with motion allowed. */}
          {bgPoster ? <MediaImage media={bgPoster} alt="" priority={ctx.pageTop} sizes="100vw" className="absolute inset-0" /> : <div aria-hidden className="bg-glow absolute inset-0" />}
          {bgVideo ? <HeroVideo src={bgVideo} /> : null}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-bg/30" />
        </>
      ) : variant === 'minimal' ? null : (
        <>
          <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
          {variant === 'cinematic' ? <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70" /> : null}
        </>
      )}
      containerClassName={cn(
        sideMedia && 'grid grid-cols-1 items-center gap-12',
        sideMedia && (variant === 'cinematic' ? 'lg:grid-cols-[1.1fr_1fr] lg:gap-16' : 'lg:grid-cols-2'),
      )}
    >
      <div className={cn('min-w-0', center && 'mx-auto max-w-3xl text-center')}>
        {block.eyebrow ? <Eyebrow className={variant === 'cinematic' ? 'mb-6' : 'mb-4'} {...enter(0)}>{block.eyebrow}</Eyebrow> : null}
        <Heading as={ctx.headingAs} size={variant === 'cinematic' ? 'display' : 'h1'} {...enter(1, 'slide')}>{block.heading}</Heading>
        {block.subheading ? <p className={cn(cinematic ? 'mt-6 max-w-xl' : 'mt-5 max-w-2xl', 'text-lead text-muted text-pretty break-words', center && 'mx-auto')} {...enter(2, 'slide')}>{block.subheading}</p> : null}
        <div className={center ? '[&>div]:justify-center' : undefined} {...enter(3)}>
          <Actions actions={block.actions} locale={locale} className={cinematic ? 'mt-10' : 'mt-8'} arrowOnSecondary />
        </div>
      </div>
      {familiesPanel ? <div className="min-w-0" {...enter(4)}><FamiliesPanel locale={locale} title={block.panelTitle} /></div> : null}
      {hasMedia ? (
        <div className={cn('min-w-0', !sideMedia && 'mt-14')} {...enter(4, 'slide')}>
          <div className={cn('overflow-hidden rounded-xl border border-border bg-surface', variant === 'cinematic' && 'p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]')}>
            <MediaImage
              media={block.media}
              priority={ctx.pageTop}
              sizes={sideMedia ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1280px) 75rem, 100vw'}
              className={cn('aspect-[16/10]', variant === 'cinematic' && 'rounded-lg')}
            />
          </div>
        </div>
      ) : null}
    </BlockShell>
  )
}
