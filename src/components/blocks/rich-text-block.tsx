import { RichContent } from '@/components/blocks/rich-text'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { RichTextBlock as Block } from '@/payload-types'

export function RichTextBlock({ block, locale }: { block: Block; locale: string }) {
  return (
    <Section theme="light" spacing="md">
      <Container size={block.width === 'wide' ? 'content' : 'narrow'} className={block.width === 'normal' || !block.width ? 'max-w-[52rem]' : undefined}>
        <RichContent data={block.content} locale={locale} />
      </Container>
    </Section>
  )
}
