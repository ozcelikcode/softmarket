import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('@/components/blocks/rich-text', () => ({ RichContent: () => null }))
vi.mock('@/lib/content', () => ({ relOf: (value: unknown) => value }))
import { FAQBlock } from '@/components/blocks/faq-block'
import { planBlocks } from '@/lib/blocks/render-plan'

it('renders native keyboard-operable disclosures in server HTML', () => {
  const block = { blockType: 'faq' as const, source: 'inline' as const, items: [{ question: 'Soru?', answer: { root: { type: 'root', children: [], direction: null, format: '' as const, indent: 0, version: 1 } } }] }
  const html = renderToStaticMarkup(<FAQBlock locale="tr" block={block} ctx={planBlocks([block])[0].ctx} />)
  expect(html).toContain('<details')
  expect(html).toContain('<summary')
  expect(html).toContain('Soru?')
  expect(html).not.toContain('<script')
})
