import { getTranslations } from 'next-intl/server'

import { Actions } from '@/components/blocks/actions'
import { BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { cn } from '@/lib/utils'
import type { CTABlock as Block } from '@/payload-types'

/** Styles: banner (dark glow band), card (centered card), split (text left, actions right on desktop). */
export async function CTABlock({ block, locale, ctx }: BlockProps<Block>) {
  const c = await getTranslations({ locale, namespace: 'common' })
  const { appearance } = ctx
  const style = block.style === 'card' || block.style === 'split' ? block.style : 'banner'
  const center = appearance.align === 'center'
  const actions = <Actions actions={block.actions} locale={locale} fallback={{ label: c('requestQuote'), href: '/teklif-iste' }} />

  if (style === 'split') {
    return (
      <BlockShell blockType="cta" appearance={appearance}>
        <div className="rounded-xl border border-border bg-surface p-8 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-2xl">
            <Heading as="h2" size="h2">{block.heading}</Heading>
            {block.body ? <p className="mt-4 text-lead text-muted text-pretty">{block.body}</p> : null}
          </div>
          <div className="shrink-0 lg:[&>div]:mt-0">{actions}</div>
        </div>
      </BlockShell>
    )
  }

  const card = style === 'card'
  return (
    <BlockShell
      blockType="cta"
      appearance={appearance}
      container={{ size: 'narrow' }}
      className={card ? undefined : 'overflow-hidden border-t border-border'}
      decor={card ? null : <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />}
    >
      <div className={cn(card && 'rounded-xl border border-border bg-surface p-8 sm:p-12', center && 'text-center')}>
        <Heading as="h2" size={card ? 'h2' : 'h1'}>{block.heading}</Heading>
        {block.body ? <p className={cn('mt-4 max-w-xl text-lead text-muted text-pretty', center && 'mx-auto')}>{block.body}</p> : null}
        <div className={cn(center && '[&>div]:justify-center')}>{actions}</div>
      </div>
    </BlockShell>
  )
}
