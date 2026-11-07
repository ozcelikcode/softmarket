import { getTranslations } from 'next-intl/server'

import { BlockShell } from '@/components/blocks/block-shell'
import { ListFrame } from '@/components/blocks/list-frame'
import type { BlockProps } from '@/components/blocks/types'
import { ListRow } from '@/components/sections/list-row'
import { ProductCard } from '@/components/sections/product-card'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { loadFamilies } from '@/lib/blocks/data'
import { gridClass, normalizeLayout, resolveViewAll, staggerIndex } from '@/lib/blocks/lists'
import { mediaOf } from '@/lib/content'
import type { ProductFamiliesBlock as Block } from '@/payload-types'

/** Product family showcase: any list of families as cards or rows. No records -> the block is not rendered. */
export async function ProductFamiliesBlock({ block, locale, ctx }: BlockProps<Block>) {
  const [{ docs, counts }, c, pr] = await Promise.all([
    loadFamilies(locale, block),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'products' }),
  ])
  if (!docs.length) return null
  const layout = normalizeLayout(block.layout)
  const showCount = block.showCount !== false
  return (
    <BlockShell blockType="productFamilies" appearance={ctx.appearance} animate="items">
      <ListFrame
        locale={locale} appearance={ctx.appearance} eyebrow={block.eyebrow} heading={block.heading} description={block.description}
        viewAll={resolveViewAll(block, '/urunler', c('viewAll'))}
      >
        <div className={gridClass(layout)}>
          {docs.map((f, i) => {
            const href = `/urunler/${encodeURIComponent(f.slug!)}`
            const count = showCount ? counts.get(f.id) : undefined
            const badge = count ? pr('count', { count }) : undefined
            return (
              <div key={f.id} {...anim(staggerIndex(i, layout), ctx.appearance.animation)} className="h-full">
                {layout === 'list' ? (
                  <ListRow
                    title={f.title} description={f.tagline} href={href} locale={locale} badge={badge}
                    icon={<NamedIcon name={f.icon} />}
                    image={mediaOf(f.image) ? <MediaImage media={f.image} sizes="96px" /> : undefined}
                  />
                ) : (
                  <ProductCard
                    title={f.title} description={f.tagline ?? undefined} href={href} locale={locale} badge={badge}
                    icon={<NamedIcon name={f.icon} />}
                    image={mediaOf(f.image) ? <MediaImage media={f.image} className="transition-transform duration-500 group-hover:scale-[1.03]" /> : undefined}
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
