import { ValidationError, type Block, type FieldHook } from 'payload'

import { blockMotion, validateHeroPreset } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import type { ProductBoundType } from '@/lib/blocks/product-composition'

import { L, blockMeta } from './meta'

/*
 * V2 product-bound blocks (plan-visual-editor §V2-S), `products.layout` only. They hold no content: each one
 * renders a section of the product page from the product record and its editions/downloads/docs
 * (src/components/blocks/product). Only appearance + motion (+ one display option) are stored.
 *
 * Additive only: slugs, field names, options and defaults must never be renamed/removed (SQLite rebuilds).
 * Section ids are fixed (genel-bakis, ozellikler …), so these blocks have no anchor field.
 * `productHero` and `productEditions` have no "hide" option: the editions block carries the required
 * "Teklif İste" (quote) actions; the hero carries the page h1. Ordering rules: src/lib/blocks/product-composition.ts.
 */

// Payload skips field validators for drafts/autosaves: keep the hero preset allowlist at the write boundary.
const enforceHeroPreset: FieldHook = ({ value, req, path }) => {
  const result = validateHeroPreset(value, { req })
  if (result !== true) throw new ValidationError({ errors: [{ path: path.join('.'), message: result }], req }, req.t)
  return value
}

function bound(
  slug: ProductBoundType,
  interfaceName: string,
  names: [singularTr: string, singularEn: string, pluralTr: string, pluralEn: string],
  options: { hideable?: boolean; fields?: Block['fields'] } = {},
): Block {
  const [str, sen, ptr, pen] = names
  return {
    slug,
    interfaceName,
    ...blockMeta(slug, [str, sen], [ptr, pen], 'product'),
    fields: [
      ...(options.fields ?? []),
      blockSettings(slug, { anchor: false, hideable: options.hideable ?? true }),
      blockMotion(slug, slug === 'productHero' ? { beforeChange: [enforceHeroPreset] } : undefined),
    ],
  }
}

export const ProductHero = bound('productHero', 'ProductHeroBlock', ['Ürün: Giriş (başlık + Teklif İste)', 'Product: Hero (title + quote)', 'Ürün girişleri', 'Product heroes'], { hideable: false })
export const ProductNav = bound('productNav', 'ProductNavBlock', ['Ürün: Sekme çubuğu', 'Product: Section tabs', 'Ürün sekme çubukları', 'Product section tabs'])
export const ProductOverview = bound('productOverview', 'ProductOverviewBlock', ['Ürün: Genel bakış', 'Product: Overview', 'Ürün genel bakışları', 'Product overviews'])
export const ProductFeatures = bound('productFeatures', 'ProductFeaturesBlock', ['Ürün: Özellikler', 'Product: Features', 'Ürün özellikleri', 'Product features'])
export const ProductSpecs = bound('productSpecs', 'ProductSpecsBlock', ['Ürün: Teknik özellikler', 'Product: Technical specs', 'Ürün teknik özellikleri', 'Product technical specs'], {
  fields: [
    {
      name: 'showRequirements',
      type: 'checkbox',
      defaultValue: true,
      label: L('Sistem gereksinimlerini göster', 'Show system requirements'),
      admin: { description: L('Ürünün "Teknik" sekmesindeki gereksinimler tablonun altında gösterilir.', 'Requirements from the product "Technical" tab are shown below the table.') },
    },
  ],
})
// Future (docs/plan-payments.md): a "Satın al" mode is an additive option on this block; the quote action stays.
export const ProductEditions = bound('productEditions', 'ProductEditionsBlock', ['Ürün: Sürümler ve Teklif İste (zorunlu)', 'Product: Editions and quote (required)', 'Ürün sürümleri', 'Product editions'], { hideable: false })
export const ProductDownloads = bound('productDownloads', 'ProductDownloadsBlock', ['Ürün: İndirmeler', 'Product: Downloads', 'Ürün indirmeleri', 'Product downloads'])
export const ProductDocs = bound('productDocs', 'ProductDocsBlock', ['Ürün: Dokümantasyon', 'Product: Documentation', 'Ürün dokümantasyonları', 'Product documentation'])

/** Order = the compatibility-mode page order. */
export const productBoundBlocks: Block[] = [
  ProductHero,
  ProductNav,
  ProductOverview,
  ProductFeatures,
  ProductSpecs,
  ProductEditions,
  ProductDownloads,
  ProductDocs,
]
