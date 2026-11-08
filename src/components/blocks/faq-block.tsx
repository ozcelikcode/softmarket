import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import { RichContent } from '@/components/blocks/rich-text'
import type { BlockProps } from '@/components/blocks/types'
import { Heading } from '@/components/ui/heading'
import { relOf } from '@/lib/content'
import { cn } from '@/lib/utils'
import type { FAQBlock as Block, Faq } from '@/payload-types'

export function FAQBlock({ block, locale, ctx }: BlockProps<Block>) {
  const items: { id: string; question: string; answer: unknown }[] =
    block.source === 'inline'
      ? (block.items ?? []).map((it, i) => ({ id: it.id ?? `i${i}`, question: it.question, answer: it.answer }))
      : (block.faqs ?? []).flatMap((f) => {
          const faq = relOf<Faq>(f)
          return faq?.question ? [{ id: String(faq.id), question: faq.question, answer: faq.answer }] : []
        })
  if (!items.length) return null
  return (
    <BlockShell blockType="faq" appearance={ctx.appearance} motion={ctx.motion} tone="raised" container={{ size: 'narrow' }}>
      {block.heading ? <Heading size="h2" className={cn('mb-8', alignClass(ctx.appearance))}>{block.heading}</Heading> : null}
      <div>
        {items.map((it) => (
          <details key={it.id} className="border-b border-border py-4">
            <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-4">{it.question}</summary>
            <div className="pt-4"><RichContent data={it.answer} locale={locale} /></div>
          </details>
        ))}
      </div>
    </BlockShell>
  )
}
