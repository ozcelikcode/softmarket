import type { Block } from 'payload'

/** Localized admin label `{ tr, en }` (admin UI language is TR by default, see payload.config i18n). */
export const L = (tr: string, en: string) => ({ tr, en })
export const opt = (value: string, tr: string, en: string) => ({ value, label: L(tr, en) })

/** Block picker groups (Payload 3.85 `Block.admin.group`). */
export const BLOCK_GROUPS = {
  intro: L('Giriş', 'Intro'),
  content: L('İçerik', 'Content'),
  catalog: L('Katalog', 'Catalog'),
  proof: L('Kanıt', 'Proof'),
  conversion: L('Dönüşüm', 'Conversion'),
  utility: L('Yardımcı', 'Utility'),
} as const

/**
 * Admin picker metadata: TR/EN labels, group and a 480x300 preview served from `public/admin/blocks`.
 * Placeholders come from `scripts/admin-block-placeholders.mjs`; F10 replaces them with real screenshots.
 */
export function blockMeta(
  slug: string,
  singular: [tr: string, en: string],
  plural: [tr: string, en: string],
  group: keyof typeof BLOCK_GROUPS,
): Pick<Block, 'labels' | 'admin' | 'imageURL' | 'imageAltText'> {
  return {
    labels: { singular: L(...singular), plural: L(...plural) },
    admin: { group: BLOCK_GROUPS[group] },
    imageURL: `/admin/blocks/${slug}.webp`,
    imageAltText: `${singular[0]} / ${singular[1]}`,
  }
}
