import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'
import { linkField } from '@/fields/link'

import { L, blockMeta, opt } from './meta'

/**
 * Stored hero variants. `default` is the cinematic layout (glow + grid, media on the right): the value
 * predates F3 and is kept because renaming it would rebuild every hero table in SQLite (plan §3).
 */
export const HERO_VARIANTS = ['default', 'split', 'centered', 'minimal'] as const

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
      ],
      admin: { description: L('Sayfanın ilk Hero bloğu sayfa başlığıdır (h1); diğerleri bölüm başlığı (h2) olur.', 'The first hero on a page is the page title (h1); others become section headings (h2).') },
    },
    { name: 'eyebrow', type: 'text', localized: true, label: L('Üst etiket', 'Eyebrow') },
    { name: 'heading', type: 'text', localized: true, required: true, label: L('Başlık', 'Heading') },
    { name: 'subheading', type: 'textarea', localized: true, label: L('Açıklama', 'Subheading') },
    { name: 'media', type: 'upload', relationTo: 'media', label: L('Görsel', 'Media') },
    {
      name: 'actions',
      type: 'array',
      maxRows: 2,
      label: L('Butonlar', 'Actions'),
      labels: { singular: L('Buton', 'Action'), plural: L('Butonlar', 'Actions') },
      fields: [linkField({ withAppearance: true })],
    },
    blockSettings('hero'),
  ],
}
