import { LogoWall, type Logo } from '@/components/sections/logo-wall'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { mediaOf, relOf } from '@/lib/content'
import type { CaseStudy, LogoWallBlock as Block, Partner } from '@/payload-types'

export function LogoWallBlock({ block }: { block: Block }) {
  const logos: Logo[] = []
  const push = (name: string | undefined, media: unknown) => {
    if (!name) return
    const m = mediaOf(media)
    logos.push({ name, src: m?.url ?? undefined, alt: name })
  }
  if (block.source === 'caseStudies') {
    for (const c of block.caseStudies ?? []) { const cs = relOf<CaseStudy>(c); if (cs) push(cs.customerName, cs.customerLogo) }
  } else if (block.source === 'partners') {
    for (const p of block.partners ?? []) { const pa = relOf<Partner>(p); if (pa) push(pa.name, pa.logo) }
  } else {
    for (const l of block.logos ?? []) push(l.name, l.logo)
  }
  if (!logos.length) return null
  return (
    <Section theme="dark" spacing="md" className="border-y border-border">
      <Container>
        {block.heading ? <p className="mb-8 text-center text-small text-muted">{block.heading}</p> : null}
        <LogoWall logos={logos} />
      </Container>
    </Section>
  )
}
