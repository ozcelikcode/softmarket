import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import type { StatsBlock as Block } from '@/payload-types'

export function StatsBlock({ block }: { block: Block }) {
  const items = block.items ?? []
  if (!items.length) return null
  return (
    <Section theme="dark" spacing="md" className="border-y border-border">
      <Container>
        {block.heading ? <Heading size="h2" className="mb-12 max-w-2xl">{block.heading}</Heading> : null}
        <dl className={`grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 ${items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
          {items.map((it, i) => (
            <div key={it.id ?? i} className="bg-surface p-7">
              <dd className="font-mono text-display leading-none text-text [font-size:clamp(2rem,1.4rem+2vw,3.25rem)]">{it.value}</dd>
              <dt className="mt-3 text-h4 text-text">{it.label}</dt>
              {it.description ? <p className="mt-1 text-small text-muted">{it.description}</p> : null}
            </div>
          ))}
        </dl>
      </Container>
    </Section>
  )
}
