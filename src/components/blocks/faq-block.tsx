import { RichContent } from '@/components/blocks/rich-text'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Container } from '@/components/ui/container'
import { Heading } from '@/components/ui/heading'
import { Section } from '@/components/ui/section'
import { relOf } from '@/lib/content'
import type { FAQBlock as Block, Faq } from '@/payload-types'

export function FAQBlock({ block, locale }: { block: Block; locale: string }) {
  const items: { id: string; question: string; answer: unknown }[] =
    block.source === 'inline'
      ? (block.items ?? []).map((it, i) => ({ id: it.id ?? `i${i}`, question: it.question, answer: it.answer }))
      : (block.faqs ?? []).flatMap((f) => {
          const faq = relOf<Faq>(f)
          return faq?.question ? [{ id: String(faq.id), question: faq.question, answer: faq.answer }] : []
        })
  if (!items.length) return null
  return (
    <Section theme="light" tone="raised" spacing="md">
      <Container size="narrow">
        {block.heading ? <Heading size="h2" className="mb-8">{block.heading}</Heading> : null}
        <Accordion type="single" collapsible>
          {items.map((it) => (
            <AccordionItem key={it.id} value={it.id}>
              <AccordionTrigger>{it.question}</AccordionTrigger>
              <AccordionContent><RichContent data={it.answer} locale={locale} /></AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Container>
    </Section>
  )
}
