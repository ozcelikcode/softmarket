import { ValidationError, type Block, type FieldHook, type UploadFieldSingleValidation } from 'payload'
import { upload } from 'payload/shared'

import { blockMotion, validateHeroPreset } from '@/fields/block-motion'
import { blockSettings } from '@/fields/block-settings'
import { linkField } from '@/fields/link'
import { publicImageFilter, publicVideoFilter } from '@/fields/public-media'

import { L, blockMeta, opt } from './meta'

/**
 * Stored hero variants. `default` is the cinematic layout (glow + grid, media on the right): the value
 * predates F3 and is kept because renaming it would rebuild every hero table in SQLite (plan §3).
 */
export const HERO_VARIANTS = ['default', 'split', 'centered', 'minimal', 'mediaBackground'] as const

const validateBackgroundVideo: UploadFieldSingleValidation = (value, options) => {
  const sibling = options.siblingData as { variant?: unknown; media?: unknown }
  if (value && sibling?.variant === 'mediaBackground' && !sibling?.media)
    return 'A poster image is required for a background video.'
  return upload(value, options)
}

// Payload skips field validators for drafts/autosaves. Keep the hero allowlist at the write boundary
// for those operations too, across REST, MCP, Local API and import (without enabling draft validation).
const enforceHeroPreset: FieldHook = ({ value, req, path }) => {
  const result = validateHeroPreset(value, { req })
  if (result !== true) throw new ValidationError({ errors: [{ path: path.join('.'), message: result }], req }, req.t)
  return value
}

export const Hero: Block = {
  slug: 'hero',
  interfaceName: 'HeroBlock',
  ...blockMeta('hero', ['Giriş (Hero)', 'Hero'], ['Girişler (Hero)', 'Heroes'], 'intro'),
  fields: [
    {
      name: 'variant',
      type: 'select',
      defaultValue: 'default',
      label: L('Yerleşim', 'Layout'),
      options: [
        opt('default', 'Sinematik (ızgara + parıltı, medya sağda)', 'Cinematic (grid + glow, media right)'),
        opt('split', 'İkiye bölünmüş (medya sağda)', 'Split (media right)'),
        opt('centered', 'Ortalanmış (medya altta)', 'Centered (media below)'),
        opt('minimal', 'Sade (dekor yok)', 'Minimal (no decoration)'),
        opt('mediaBackground', 'Arka plan görseli / videosu (tam genişlik)', 'Background image / video (full bleed)'),
      ],
      admin: { description: L('Sayfanın ilk Hero bloğu sayfa başlığıdır (h1); diğerleri bölüm başlığı (h2) olur.', 'The first hero on a page is the page title (h1); others become section headings (h2).') },
    },
    { name: 'eyebrow', type: 'text', localized: true, label: L('Üst etiket', 'Eyebrow') },
    { name: 'heading', type: 'text', localized: true, required: true, label: L('Başlık', 'Heading') },
    { name: 'subheading', type: 'textarea', localized: true, label: L('Açıklama', 'Subheading') },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      filterOptions: publicImageFilter,
      label: L('Görsel', 'Media'),
      admin: { description: L('"Arka plan" yerleşiminde bu görsel poster ve LCP görselidir; video yüklenmediğinde (mobil, hareket azaltma) bu görsel görünür.', 'In the "Background" layout this image is the poster and LCP image; it is what shows when the video does not load (mobile, reduced motion).') },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'aside',
          type: 'select',
          defaultValue: 'media',
          label: L('Sağ panel', 'Side panel'),
          options: [
            opt('media', 'Görsel (yukarıdaki alan)', 'Image (field above)'),
            opt('families', 'Ürün aileleri listesi (otomatik)', 'Product family list (automatic)'),
          ],
          admin: {
            width: '50%',
            condition: (_, siblingData) => !siblingData?.variant || siblingData.variant === 'default' || siblingData.variant === 'split',
            description: L('Ürün aileleri: yayınlı ilk 5 aile, ürün sayılarıyla.', 'Product families: first 5 published families with product counts.'),
          },
        },
        {
          name: 'panelTitle',
          type: 'text',
          localized: true,
          label: L('Panel başlığı', 'Panel title'),
          admin: {
            width: '50%',
            condition: (_, siblingData) => siblingData?.aside === 'families',
            description: L('Boşsa "Ürün aileleri".', 'Empty: "Product families".'),
          },
        },
      ],
    },
    {
      name: 'video',
      type: 'upload',
      relationTo: 'media',
      label: L('Arka plan videosu (isteğe bağlı)', 'Background video (optional)'),
      filterOptions: publicVideoFilter,
      validate: validateBackgroundVideo,
      admin: {
        condition: (_, siblingData) => siblingData?.variant === 'mediaBackground',
        description: L(
          'Kısa (≤ 15 sn), sessiz, döngülü MP4/WebM; genel görünür (protected kapalı) yükleyin. Yalnız masaüstünde ve hareket azaltma kapalıyken yüklenir; aksi halde poster görünür. Poster görseli zorunludur.',
          'Short (≤ 15 s), silent, looping MP4/WebM; upload publicly (protected off). Loads only on desktop with reduced motion off; otherwise the poster shows. A poster image is required.',
        ),
      },
    },
    {
      name: 'actions',
      type: 'array',
      maxRows: 2,
      label: L('Butonlar', 'Actions'),
      labels: { singular: L('Buton', 'Action'), plural: L('Butonlar', 'Actions') },
      fields: [linkField({ withAppearance: true })],
    },
    blockSettings('hero'),
    blockMotion('hero', { beforeValidate: [enforceHeroPreset] }),
  ],
}
