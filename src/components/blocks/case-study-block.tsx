import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { alignClass, BlockShell } from '@/components/blocks/block-shell'
import type { BlockProps } from '@/components/blocks/types'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Eyebrow, Heading } from '@/components/ui/heading'
import { anim } from '@/lib/anim'
import { loadCaseStudy } from '@/lib/blocks/data'
import { safeHref } from '@/lib/utils'
import type { CaseStudyBlock as Block } from '@/payload-types'

/** One case study (featured, newest, selected or by industry) with customer, summary and result metrics. */
export async function CaseStudyBlock({ block, locale, ctx }: BlockProps<Block>) {
  const [study, c] = await Promise.all([loadCaseStudy(locale, block), getTranslations({ locale, namespace: 'common' })])
  if (!study) return null
  const { appearance } = ctx
  const results = block.showResults === false ? [] : (study.results ?? []).slice(0, 4)
  const custom = typeof block.linkUrl === 'string' ? safeHref(block.linkUrl.trim()) : null
  const href = custom && /^(?:\/(?!\/)|https?:\/\/)/i.test(custom) ? custom : `/referanslar/${encodeURIComponent(study.slug!)}`
  return (
    <BlockShell blockType="caseStudy" appearance={appearance} animate="items" containerClassName={results.length ? 'grid items-center gap-12 lg:grid-cols-2' : undefined}>
      <div {...anim(0, appearance.animation)} className={alignClass(appearance)}>
        {block.eyebrow ? <Eyebrow className="mb-4">{block.eyebrow}</Eyebrow> : null}
        <Heading as="h2" size="h1">{study.title}</Heading>
        <p className="mt-3 text-small text-muted">{study.customerName}</p>
        {study.summary ? <p className="mt-5 text-lead text-muted text-pretty">{study.summary}</p> : null}
        {block.showLink !== false ? (
          <Button asChild className="mt-8" variant="secondary">
            <AppLink href={href} locale={locale}>{block.linkLabel?.trim() || c('learnMore')}<ArrowRight aria-hidden /></AppLink>
          </Button>
        ) : null}
      </div>
      {results.length ? (
        <dl {...anim(1, appearance.animation)} className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {results.map((r, i) => (
            <div key={r.id ?? i} className="bg-surface p-6">
              <dd className="font-mono text-h1 text-text">{r.value}</dd>
              <dt className="mt-2 text-small text-muted">{r.label}</dt>
            </div>
          ))}
        </dl>
      ) : null}
    </BlockShell>
  )
}
