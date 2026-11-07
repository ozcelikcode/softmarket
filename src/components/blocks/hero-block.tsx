import { Actions } from '@/components/blocks/actions'
import { BlockShell } from '@/components/blocks/block-shell'
import { HeroVideo } from '@/components/blocks/hero-video'
import type { BlockProps } from '@/components/blocks/types'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { heroIn } from '@/lib/anim'
import { mediaOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { HeroBlock as Block } from '@/payload-types'

export type HeroVariant = 'cinematic' | 'split' | 'centered' | 'minimal' | 'mediaBackground'

/** Stored value -> layout. `default` (and anything unknown/legacy) is the cinematic layout. */
export function heroVariant(value: Block['variant']): HeroVariant {
  return value === 'split' || value === 'centered' || value === 'minimal' || value === 'mediaBackground' ? value : 'cinematic'
}

/**
 * Hero variants: cinematic (glow + grid, display heading, framed media on the right), split (equal
 * columns), centered (media below) and minimal (no decoration). Heading level comes from the page plan
 * (first hero on a CMS-driven page = h1). Entrance uses the CSS-only hero keyframes; title/lead only slide.
 */
export function HeroBlock({ block, locale, ctx }: BlockProps<Block>) {
  const { appearance } = ctx
  const variant = heroVariant(block.variant)
  const hasMedia = Boolean(mediaOf(block.media)) && variant !== 'mediaBackground'
  const sideMedia = hasMedia && (variant === 'cinematic' || variant === 'split')
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
      className={cn('overflow-hidden', ctx.pageTop && 'pt-32 sm:pt-40', variant === 'mediaBackground' && 'flex min-h-[32rem] items-center sm:min-h-[40rem]')}
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
        {block.subheading ? <p className={cn('mt-5 max-w-2xl text-lead text-muted text-pretty break-words', center && 'mx-auto')} {...enter(2, 'slide')}>{block.subheading}</p> : null}
        <div className={center ? '[&>div]:justify-center' : undefined} {...enter(3)}>
          <Actions actions={block.actions} locale={locale} />
        </div>
      </div>
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
