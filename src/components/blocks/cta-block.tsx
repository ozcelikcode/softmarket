import { Actions } from '@/components/blocks/actions'
import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import type { CTABlock as Block } from '@/payload-types'

export function CTABlock({ block, locale }: { block: Block; locale: string }) {
  const card = block.style === 'card'
  return (
    <Section theme={card ? 'light' : 'dark'} spacing="md" className={card ? undefined : 'overflow-hidden border-t border-border'}>
      {card ? null : <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />}
      <Container size="narrow" className="relative">
        <div className={card ? 'rounded-xl border border-border bg-surface p-8 text-center sm:p-12' : 'text-center'}>
          <Heading as="h2" size={card ? 'h2' : 'h1'}>{block.heading}</Heading>
          {block.body ? <p className="mx-auto mt-4 max-w-xl text-lead text-muted text-pretty">{block.body}</p> : null}
          <div className="[&>div]:justify-center"><Actions actions={block.actions} locale={locale} /></div>
        </div>
      </Container>
    </Section>
  )
}
