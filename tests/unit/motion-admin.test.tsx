import { renderToStaticMarkup } from 'react-dom/server'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ value: 'auto', delay: '0' }))
vi.mock('@payloadcms/ui', () => ({
  FieldLabel: () => <span>Motion</span>,
  FieldError: () => <span>Validation error</span>,
  useTranslation: () => ({ i18n: { language: 'en' } }),
  useField: () => ({ value: state.value, setValue: vi.fn() }),
  useFormFields: (select: (args: unknown) => unknown) => select([{ 'layout.0.motion.delay': { value: state.delay } }]),
}))

import { MotionPresetCards } from '@/admin/fields/motion-preset-cards'
import { HERO_PRESETS } from '@/fields/block-motion'

const render = () => renderToStaticMarkup(<MotionPresetCards {...{
  path: 'layout.0.motion.preset', field: { label: 'Motion', admin: { custom: { presets: HERO_PRESETS } } },
} as unknown as ComponentProps<typeof MotionPresetCards>} />)

describe('admin motion cards with legacy/invalid stored values', () => {
  it('renders without crashing and always offers only the seven hero presets', () => {
    for (const value of ['unknown', '__proto__', 'fade', 'zoom-in', 'stagger']) {
      state.value = value
      const html = render()
      expect((html.match(/type="radio"/g) ?? []).length).toBe(7)
      expect(html).not.toContain(`value="${value}"`)
    }
  })
  it('ignores delays outside the enum and renders the field validation error', () => {
    state.value = 'auto'
    state.delay = '99999999'
    const html = render()
    expect(html).not.toContain('--w:99999999ms')
    expect(html).toContain('Validation error')
  })
})
