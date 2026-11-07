import { getTranslations } from 'next-intl/server'

import { BlockShell } from '@/components/blocks/block-shell'
import { ListFrame } from '@/components/blocks/list-frame'
import type { BlockProps } from '@/components/blocks/types'
import { ListRow } from '@/components/sections/list-row'
import { MediaCard } from '@/components/sections/media-card'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { loadPosts } from '@/lib/blocks/data'
import { gridClass, normalizeLayout, resolveViewAll, staggerIndex } from '@/lib/blocks/lists'
import { mediaOf } from '@/lib/content'
import { formatDate } from '@/lib/format'
import type { NewsListBlock as Block } from '@/payload-types'

const CATEGORIES = ['news', 'product-update', 'event', 'blog']

export async function NewsListBlock({ block, locale, ctx }: BlockProps<Block>) {
  const [docs, c, n] = await Promise.all([
    loadPosts(locale, block),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'news' }),
  ])
  if (!docs.length) return null
  const layout = normalizeLayout(block.layout)
  return (
    <BlockShell blockType="newsList" appearance={ctx.appearance} animate="items">
      <ListFrame
        locale={locale} appearance={ctx.appearance} eyebrow={block.eyebrow} heading={block.heading} description={block.description}
        viewAll={resolveViewAll(block, '/haberler', c('viewAll'))}
      >
        <div className={gridClass(layout)}>
          {docs.map((p, i) => {
            const href = `/haberler/${encodeURIComponent(p.slug!)}`
            const badge = p.category && CATEGORIES.includes(p.category) ? n(`cat.${p.category}`) : null
            return (
              <div key={p.id} {...anim(staggerIndex(i, layout), ctx.appearance.animation)} className="h-full">
                {layout === 'list' ? (
                  <ListRow
                    title={p.title} description={p.excerpt} href={href} locale={locale} badge={badge} meta={formatDate(p.publishedAt, locale)}
                    image={mediaOf(p.coverImage) ? <MediaImage media={p.coverImage} sizes="96px" /> : undefined}
                  />
                ) : (
                  <MediaCard href={href} locale={locale} title={p.title} description={p.excerpt} image={p.coverImage} badge={badge} meta={formatDate(p.publishedAt, locale)} />
                )}
              </div>
            )
          })}
        </div>
      </ListFrame>
    </BlockShell>
  )
}
