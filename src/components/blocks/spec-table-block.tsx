import { SpecTable } from '@/components/product/spec-table'
import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import type { SpecTableBlock as Block } from '@/payload-types'

export function SpecTableBlock({ block }: { block: Block }) {
  const groups = (block.groups ?? []).map((g) => ({ title: g.title ?? undefined, rows: (g.rows ?? []).map((r) => [r.label, r.value] as [string, string]) }))
  if (!groups.some((g) => g.rows.length)) return null
  return (
    <Section theme="light" spacing="md">
      <Container size="narrow" className="max-w-content">
        {block.heading ? <Heading size="h2" className="mb-10">{block.heading}</Heading> : null}
        <SpecTable groups={groups} />
      </Container>
    </Section>
  )
}
