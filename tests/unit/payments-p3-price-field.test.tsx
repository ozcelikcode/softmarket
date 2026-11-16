// @vitest-environment happy-dom
import { act, useSyncExternalStore, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const field = vi.hoisted(() => ({ value: 125000 as number | null, listeners: new Set<() => void>() }))
vi.mock('@payloadcms/ui', () => ({
  FieldError: () => null,
  FieldLabel: () => null,
  useTranslation: () => ({ i18n: { language: 'tr' } }),
  useField: () => ({
    value: useSyncExternalStore((fn) => { field.listeners.add(fn); return () => { field.listeners.delete(fn) } }, () => field.value),
    setValue: (value: number | null) => { field.value = value; field.listeners.forEach((fn) => fn()) },
    showError: false,
  }),
}))

import { PriceMinorField } from '@/admin/fields/price-minor-field'
let root: Root
let container: HTMLDivElement
const render = () => <PriceMinorField {...{ field: { name: 'tryMinor', type: 'number', label: 'TRY' }, path: 'pricing.tryMinor' } as ComponentProps<typeof PriceMinorField>} />
const input = () => container.querySelector('input')!
const setStored = async (value: number | null) => {
  await act(async () => { field.value = value; field.listeners.forEach((fn) => fn()) })
}
const type = async (text: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(input(), text)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  field.value = 125000
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => { root.render(render()) })
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); field.listeners.clear() })

it('keeps invalid typed text with -1, then accepts an external reset/document change', async () => {
  expect(input().value).toBe('1.250,00')
  await type('garbled')
  expect(field.value).toBe(-1)
  expect(input().getAttribute('aria-invalid')).toBe('true')
  await setStored(500000)
  expect(input().value).toBe('5.000,00')
  expect(input().getAttribute('aria-invalid')).toBeNull()
})

it('preserves incomplete input across local echoes but resets it when the stored value is cleared', async () => {
  await type('12,')
  expect(field.value).toBe(-1)
  expect(input().value).toBe('12,')
  await setStored(null)
  expect(input().value).toBe('')
  expect(input().getAttribute('aria-invalid')).toBeNull()
})
