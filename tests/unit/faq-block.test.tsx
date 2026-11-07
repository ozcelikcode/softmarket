import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('@/components/blocks/rich-text', () => ({ RichContent: () => null }))
vi.mock('@/lib/content', () => ({ relOf: (value: unknown) => value }))
import { FAQBlock } from '@/components/blocks/faq-block'

it('renders native keyboard-operable disclosures in server HTML', () => {
  const html = renderToStaticMarkup(<FAQBlock locale="tr" block={{ blockType: 'faq', source: 'inline', items: [{ question: 'Soru?', answer: { root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 } } }] }} />)
  expect(html).toContain('<details')
  expect(html).toContain('<summary')
  expect(html).toContain('Soru?')
  expect(html).not.toContain('<script')
})
