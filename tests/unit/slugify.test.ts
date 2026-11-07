import { describe, expect, it } from 'vitest'

import { SLUG_PATTERN, slugify } from '../../src/lib/slugify'

describe('slugify', () => {
  it('transliterates Turkish characters', () => {
    expect(slugify('Güvenlik Çözümleri')).toBe('guvenlik-cozumleri')
    expect(slugify('IŞIK ışık İstanbul Ağ')).toBe('isik-isik-istanbul-ag')
  })

  it('collapses separators and trims', () => {
    expect(slugify('  ERP & CRM -- Suite 2026!  ')).toBe('erp-crm-suite-2026')
    expect(SLUG_PATTERN.test(slugify('Ürün / Sürüm 3.2'))).toBe(true)
  })

  it('strips other diacritics', () => {
    expect(slugify('Café Déjà Vu')).toBe('cafe-deja-vu')
  })
})

import { vi } from 'vitest'
import { slugField } from '../../src/fields/slug'

it('checks scoped slug uniqueness with a locale-aware bounded find (SQLite count loses locale)', async () => {
  const find = vi.fn().mockResolvedValue({ docs: [] })
  const field = slugField({ scope: 'product' })
  const validate = field.validate as (value: string, options: unknown) => Promise<unknown>
  const options = {
    req: { locale: 'en', payload: { find } },
    data: { product: 3 },
    id: 7,
    collectionSlug: 'docs',
  }
  expect(await validate('start', options)).toBe(true)
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'docs',
      locale: 'en',
      limit: 1,
      depth: 0,
      select: { slug: true },
      where: {
        and: [{ slug: { equals: 'start' } }, { product: { equals: 3 } }, { id: { not_equals: 7 } }],
      },
    }),
  )
  find.mockResolvedValue({ docs: [{ id: 9 }] })
  expect(await validate('start', options)).not.toBe(true)
})
