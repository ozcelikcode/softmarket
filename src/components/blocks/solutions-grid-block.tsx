import { getTranslations } from 'next-intl/server'

import { BlockShell } from '@/components/blocks/block-shell'
import { ListFrame } from '@/components/blocks/list-frame'
import type { BlockProps } from '@/components/blocks/types'
import { ListRow } from '@/components/sections/list-row'
import { ProductCard } from '@/components/sections/product-card'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { loadSolutions } from '@/lib/blocks/data'
import { gridClass, normalizeLayout, resolveViewAll, staggerIndex } from '@/lib/blocks/lists'
import { mediaOf } from '@/lib/content'
import type { SolutionsGridBlock as Block } from '@/payload-types'

export async function SolutionsGridBlock({ block, locale, ctx }: BlockProps<Block>) {
  const [docs, c] = await Promise.all([loadSolutions(locale, block), getTranslations({ locale, namespace: 'common' })])
  if (!docs.length) return null
  const layout = normalizeLayout(block.layout, 'grid-4')
  return (
    <BlockShell blockType="solutionsGrid" appearance={ctx.appearance} animate="items">
      <ListFrame
        locale={locale} appearance={ctx.appearance} eyebrow={block.eyebrow} heading={block.heading} description={block.description}
        viewAll={resolveViewAll(block, '/cozumler', c('viewAll'))}
      >
        <div className={gridClass(layout)}>
          {docs.map((s, i) => {
            const href = `/cozumler/${encodeURIComponent(s.slug!)}`
            return (
              <div key={s.id} {...anim(staggerIndex(i, layout), ctx.appearance.animation)} className="h-full">
                {layout === 'list' ? (
                  <ListRow
                    title={s.title} description={s.summary} href={href} locale={locale}
                    icon={<NamedIcon name="workflow" />}
                    image={mediaOf(s.heroImage) ? <MediaImage media={s.heroImage} sizes="96px" /> : undefined}
                  />
                ) : (
                  <ProductCard
                    title={s.title} description={s.summary ?? undefined} href={href} locale={locale}
                    icon={<NamedIcon name="workflow" />}
                    image={mediaOf(s.heroImage) ? <MediaImage media={s.heroImage} className="transition-transform duration-500 group-hover:scale-[1.03]" /> : undefined}
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
