import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { BlockShell } from '@/components/blocks/block-shell'
import { ListFrame } from '@/components/blocks/list-frame'
import type { BlockProps } from '@/components/blocks/types'
import { ListRow } from '@/components/sections/list-row'
import { ProductCard } from '@/components/sections/product-card'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/heading'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { loadProducts, type ShowcaseProduct } from '@/lib/blocks/data'
import { gridClass, normalizeLayout, resolveViewAll, staggerIndex } from '@/lib/blocks/lists'
import { mediaOf, relOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { ProductFamily, ProductShowcaseBlock as Block } from '@/payload-types'

const hrefOf = (p: ShowcaseProduct) => `/urunler/${encodeURIComponent(relOf<ProductFamily>(p.family)!.slug!)}/${encodeURIComponent(p.slug!)}`

/** Featured/selected/filtered products as cards, rows or alternating image + text stories. */
export async function ProductShowcaseBlock({ block, locale, ctx }: BlockProps<Block>) {
  const [docs, c] = await Promise.all([loadProducts(locale, block), getTranslations({ locale, namespace: 'common' })])
  if (!docs.length) return null
  const alternating = block.layout === 'alternating'
  const layout = alternating ? 'alternating' : normalizeLayout(block.layout)
  return (
    <BlockShell blockType="productShowcase" appearance={ctx.appearance} motion={ctx.motion} animate="items">
      <ListFrame
        locale={locale} appearance={ctx.appearance} eyebrow={block.eyebrow} heading={block.heading} description={block.description}
        viewAll={resolveViewAll(block, '/urunler', c('viewAll'))}
      >
        <div className={gridClass(layout)}>
          {docs.map((p, i) => {
            const href = hrefOf(p)
            const family = relOf<ProductFamily>(p.family)?.title
            const text = p.tagline || p.summary
            const image = mediaOf(p.heroImage)
            return (
              <div key={p.id} {...anim(staggerIndex(i, layout), ctx.motion)} className={alternating ? undefined : 'h-full'}>
                {alternating ? (
                  <article className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
                    <div className={cn('min-w-0', i % 2 === 1 && 'lg:order-2')}>
                      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface-2">
                        {image ? <MediaImage media={p.heroImage} sizes="(min-width: 1024px) 50vw, 100vw" /> : <div aria-hidden className="bg-brand-pattern absolute inset-0" />}
                      </div>
                    </div>
                    <div className="min-w-0">
                      {family ? <Eyebrow className="mb-3">{family}</Eyebrow> : null}
                      <h3 className="text-h2 text-text text-balance break-words">{p.title}</h3>
                      {text ? <p className="mt-4 text-lead text-muted text-pretty">{text}</p> : null}
                      {p.tagline && p.summary ? <p className="mt-3 text-small text-muted text-pretty">{p.summary}</p> : null}
                      <Button asChild className="mt-7" variant="secondary">
                        <AppLink href={href} locale={locale}>{c('learnMore')}<ArrowRight aria-hidden /></AppLink>
                      </Button>
                    </div>
                  </article>
                ) : layout === 'list' ? (
                  <ListRow
                    title={p.title} description={text} href={href} locale={locale} badge={family}
                    image={image ? <MediaImage media={p.heroImage} sizes="96px" /> : undefined}
                  />
                ) : (
                  <ProductCard
                    title={p.title} description={text ?? undefined} href={href} locale={locale} badge={family}
                    image={image ? <MediaImage media={p.heroImage} className="transition-transform duration-500 group-hover:scale-[1.03]" /> : undefined}
                  />
                )}
              </div>
            )
          })}
        </div>
      </ListFrame>
    </BlockShell>
  )
}
