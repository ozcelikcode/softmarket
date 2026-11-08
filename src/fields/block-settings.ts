import type { CollapsibleField, Field, TextFieldSingleValidation } from 'payload'

/**
 * Shared `appearance` settings for every layout block (plan §2.2). Pure module: imported by the Payload
 * config (field factory + defaults) and by the renderer (resolveAppearance), so defaults live in one place.
 * Defaults reproduce each block's pre-F3 look; rows without the new columns resolve to the same values.
 */

export const BLOCK_THEMES = ['auto', 'dark', 'light'] as const
export const BLOCK_SPACINGS = ['none', 'sm', 'md', 'lg'] as const
export const BLOCK_ALIGNS = ['start', 'center'] as const
export const BLOCK_WIDTHS = ['narrow', 'normal', 'wide'] as const
export const BLOCK_ANIMATIONS = ['subtle', 'none'] as const
/** Hairline between sections (F6): `top` draws the border-t the hand-built home sections used. */
export const BLOCK_SEPARATORS = ['none', 'top'] as const

export type BlockTheme = (typeof BLOCK_THEMES)[number]
export type BlockSpacing = (typeof BLOCK_SPACINGS)[number]
export type BlockAlign = (typeof BLOCK_ALIGNS)[number]
export type BlockWidth = (typeof BLOCK_WIDTHS)[number]
export type BlockAnimation = (typeof BLOCK_ANIMATIONS)[number]
export type BlockSeparator = (typeof BLOCK_SEPARATORS)[number]

/** HTML id for in-page links (`/sayfa#anchor`). */
export const ANCHOR_PATTERN = /^[a-z0-9-]{1,40}$/
/** Ids the site chrome / product page already uses; a block anchor must not duplicate them. */
export const RESERVED_ANCHORS = ['main', 'genel-bakis', 'ozellikler', 'teknik-ozellikler', 'surumler', 'indirmeler', 'dokumantasyon'] as const

type AppearanceInput = {
  theme?: string | null
  spacing?: string | null
  align?: string | null
  width?: string | null
  animation?: string | null
  anchor?: string | null
  hidden?: boolean | null
  separator?: string | null
}
type BlockLike = { blockType: string; appearance?: AppearanceInput | null } & Record<string, unknown>

export type BlockDefaults = {
  /** Theme used when the editor leaves `auto`; may depend on other block fields (e.g. CTA style). */
  theme: 'dark' | 'light' | ((block: BlockLike) => 'dark' | 'light')
  spacing: BlockSpacing
  align: BlockAlign
  animation: BlockAnimation
  /** `false`: the block has no width option (rich text keeps its own pre-existing `width` field). */
  width: boolean
}

const base = { spacing: 'md', align: 'start', animation: 'subtle', width: true } as const

/** Per block type. Matches the hard-coded section settings these blocks rendered with before F3. */
export const BLOCK_DEFAULTS: Record<string, BlockDefaults> = {
  hero: { ...base, theme: 'dark', spacing: 'lg' },
  featureGrid: { ...base, theme: 'light' },
  mediaText: { ...base, theme: 'light' },
  specTable: { ...base, theme: 'light' },
  stats: { ...base, theme: 'dark' },
  logoWall: { ...base, theme: 'dark', align: 'center' },
  cta: { ...base, theme: (b) => (b.style === 'card' || b.style === 'split' ? 'light' : 'dark'), align: 'center' },
  faq: { ...base, theme: 'light' },
  richText: { ...base, theme: 'light', width: false },
  videoEmbed: { ...base, theme: 'dark' },
  media: { ...base, theme: 'light' },
  testimonial: { ...base, theme: 'light', align: 'center' },
  tabs: { ...base, theme: 'light' },
  spacer: { ...base, theme: 'light', spacing: 'none', width: false },
  divider: { ...base, theme: 'light', spacing: 'sm' },
  productFamilies: { ...base, theme: 'light', spacing: 'lg' },
  productShowcase: { ...base, theme: 'light', spacing: 'lg' },
  solutionsGrid: { ...base, theme: 'dark', spacing: 'lg' },
  caseStudy: { ...base, theme: 'dark', spacing: 'lg' },
  newsList: { ...base, theme: 'light', spacing: 'lg' },
  // The route's own list (system pages, F6); defaults equal the pre-F6 list section (light, md).
  listing: { ...base, theme: 'light', width: false },
  // V2 product-bound blocks (products.layout only): defaults equal the pre-V2 product page sections.
  productHero: { ...base, theme: 'dark', spacing: 'none', width: false },
  productNav: { ...base, theme: 'dark', spacing: 'none', width: false },
  productOverview: { ...base, theme: 'light', width: false },
  productFeatures: { ...base, theme: 'light', width: false },
  productSpecs: { ...base, theme: 'light', width: false },
  productEditions: { ...base, theme: 'dark', spacing: 'lg', width: false },
  productDownloads: { ...base, theme: 'light', width: false },
  productDocs: { ...base, theme: 'light', width: false },
}
const FALLBACK: BlockDefaults = { ...base, theme: 'light' }

export type ResolvedAppearance = {
  theme: 'dark' | 'light'
  spacing: BlockSpacing
  align: BlockAlign
  width: BlockWidth
  animation: BlockAnimation
  anchor?: string
  hidden: boolean
  separator: BlockSeparator
}

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

/** Stored (possibly missing/legacy) appearance -> concrete render settings. Never throws. */
export function resolveAppearance(block: BlockLike): ResolvedAppearance {
  const d = Object.hasOwn(BLOCK_DEFAULTS, block.blockType) ? BLOCK_DEFAULTS[block.blockType] : FALLBACK
  const a = block.appearance ?? {}
  const autoTheme = typeof d.theme === 'function' ? d.theme(block) : d.theme
  const theme = a.theme === 'dark' || a.theme === 'light' ? a.theme : autoTheme
  const anchor = typeof a.anchor === 'string' && ANCHOR_PATTERN.test(a.anchor) && !(RESERVED_ANCHORS as readonly string[]).includes(a.anchor) ? a.anchor : undefined
  return {
    theme,
    spacing: pick(BLOCK_SPACINGS, a.spacing, d.spacing),
    align: pick(BLOCK_ALIGNS, a.align, d.align),
    width: d.width ? pick(BLOCK_WIDTHS, a.width, 'normal') : 'normal',
    animation: pick(BLOCK_ANIMATIONS, a.animation, d.animation),
    ...(anchor ? { anchor } : {}),
    hidden: a.hidden === true,
    separator: pick(BLOCK_SEPARATORS, a.separator, 'none'),
  }
}

/** Every block anchor in a document (any blocks field, any depth). */
export function collectAnchors(data: unknown, out: string[] = [], depth = 0): string[] {
  if (!data || typeof data !== 'object' || depth > 8) return out
  if (Array.isArray(data)) {
    for (const item of data) collectAnchors(item, out, depth + 1)
    return out
  }
  const record = data as Record<string, unknown>
  if (typeof record.blockType === 'string') {
    const anchor = (record.appearance as AppearanceInput | undefined)?.anchor
    if (typeof anchor === 'string' && anchor) out.push(anchor.trim().toLowerCase())
  }
  for (const value of Object.values(record)) if (value && typeof value === 'object') collectAnchors(value, out, depth + 1)
  return out
}

const msg = (req: { i18n?: { language?: string } } | undefined, tr: string, en: string) =>
  req?.i18n?.language === 'en' ? en : tr

export const validateAnchor: TextFieldSingleValidation = (value, { data, req }) => {
  if (value === null || value === undefined || value === '') return true
  if (!ANCHOR_PATTERN.test(value))
    return msg(req, 'Yalnız küçük harf (a-z), rakam ve tire; en çok 40 karakter.', 'Only a-z, 0-9 and hyphen; max 40 characters.')
  if ((RESERVED_ANCHORS as readonly string[]).includes(value))
    return msg(req, `"${value}" sayfa tarafından kullanılıyor; başka bir anchor seçin.`, `"${value}" is used by the page; choose another anchor.`)
  if (collectAnchors(data).filter((a) => a === value).length > 1)
    return msg(req, `"${value}" bu sayfada birden fazla blokta kullanılıyor.`, `"${value}" is used by more than one block on this page.`)
  return true
}

/**
 * Drizzle enum name for an appearance select. Keeps Payload's default (`enum_<table>_appearance_<key>`)
 * whenever it fits the 63 character identifier limit, so existing schemas are unchanged; longer table
 * names (e.g. `product_families_blocks_product_showcase`, F6) get a shortened, collision-free name.
 * SQLite has no enum types: the name only exists in the drizzle schema.
 */
export function appearanceEnumName(key: string) {
  return ({ tableName }: { tableName?: string }) => {
    const table = tableName ?? 'block'
    const full = `enum_${table}_appearance_${key}`
    if (full.length <= 63) return full
    let hash = 5381
    for (const ch of table) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0
    const short = `enum_${table}_${key}`
    return short.length <= 63 ? short : `enum_${table.slice(0, 40)}_${hash.toString(36)}_${key.slice(0, 4)}`
  }
}

const L = (tr: string, en: string) => ({ tr, en })
const opt = (value: string, tr: string, en: string) => ({ value, label: L(tr, en) })

const anchorField = (): Field => ({
  name: 'anchor',
  type: 'text',
  label: L('Anchor (bağlantı kimliği)', 'Anchor id'),
  validate: validateAnchor,
  hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() || null : value)] },
  admin: {
    width: '50%',
    description: L('Sayfa içi bağlantı için, ör. "ozellikler" → /sayfa#ozellikler. Sayfada tekil olmalı.', 'For in-page links, e.g. "features" → /page#features. Must be unique on the page.'),
  },
})

const hiddenField = (): Field => ({
  name: 'hidden',
  type: 'checkbox',
  defaultValue: false,
  label: L('Bloğu gizle', 'Hide block'),
  admin: { width: '50%', description: L('Blok kayıtta kalır ama sitede gösterilmez.', 'The block stays in the document but is not rendered.') },
})

/**
 * "Görünüm" collapsible holding the `appearance` group. Additive only: names/options must never be renamed
 * or removed (SQLite rebuilds tables on such changes). Column defaults equal BLOCK_DEFAULTS, so the
 * migration fills existing rows with the values the renderer would derive anyway.
 */
export function blockSettings(
  blockType: keyof typeof BLOCK_DEFAULTS,
  /**
   * V2 product-bound blocks: `anchor: false` (the section id is fixed, e.g. `surumler`), `hideable: false`
   * (required sections such as the editions/quote block cannot be hidden). Omitted fields create no column.
   */
  options: { anchor?: boolean; hideable?: boolean } = {},
): CollapsibleField {
  const { anchor = true, hideable = true } = options
  const d = BLOCK_DEFAULTS[blockType] ?? FALLBACK
  const fields: Field[] = [
    {
      type: 'row',
      fields: [
        {
          name: 'theme',
          type: 'select',
          enumName: appearanceEnumName('theme'),
          defaultValue: 'auto',
          label: L('Tema', 'Theme'),
          options: [opt('auto', 'Otomatik (blok varsayılanı)', 'Auto (block default)'), opt('dark', 'Koyu', 'Dark'), opt('light', 'Açık', 'Light')],
          admin: { width: '33%' },
        },
        {
          name: 'spacing',
          type: 'select',
          enumName: appearanceEnumName('spacing'),
          defaultValue: d.spacing,
          label: L('Dikey boşluk', 'Vertical spacing'),
          options: [opt('none', 'Yok', 'None'), opt('sm', 'Küçük', 'Small'), opt('md', 'Orta', 'Medium'), opt('lg', 'Büyük', 'Large')],
          admin: { width: '33%' },
        },
        {
          name: 'animation',
          type: 'select',
          defaultValue: d.animation,
          label: L('Animasyon', 'Animation'),
          options: [opt('subtle', 'Hafif (görününce)', 'Subtle (on reveal)'), opt('none', 'Yok', 'None')],
          // `enum__case_studies_v_blocks_<slug>_appearance_animation` exceeds Payload's 63 char limit for 15+ char
          // slugs (productFamilies). The enum name only exists in the drizzle schema (SQLite has no enums).
          enumName: blockType.length >= 15 ? ({ tableName }: { tableName?: string }) => `enum_${tableName}_anim` : appearanceEnumName('animation'),
          admin: { width: '33%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'align',
          type: 'select',
          enumName: appearanceEnumName('align'),
          defaultValue: d.align,
          label: L('Hizalama', 'Alignment'),
          options: [opt('start', 'Sola', 'Start'), opt('center', 'Ortala', 'Center')],
          admin: { width: '33%', description: L('Başlık ve metin hizası.', 'Heading and text alignment.') },
        },
        ...(d.width
          ? [{
              name: 'width',
              type: 'select',
              enumName: appearanceEnumName('width'),
              defaultValue: 'normal',
              label: L('Genişlik', 'Width'),
              options: [opt('narrow', 'Dar', 'Narrow'), opt('normal', 'Normal (blok varsayılanı)', 'Normal (block default)'), opt('wide', 'Geniş', 'Wide')],
              admin: { width: '33%' },
            } satisfies Field]
          : []),
        {
          name: 'separator',
          type: 'select',
          defaultValue: 'none',
          label: L('Ayraç çizgisi', 'Separator line'),
          options: [opt('none', 'Yok', 'None'), opt('top', 'Üstte ince çizgi', 'Hairline on top')],
          enumName: appearanceEnumName('separator'),
          admin: { width: '33%', description: L('Önceki bölümle arasına çizgi.', 'Line between this and the previous section.') },
        },
      ],
    },
    ...(anchor || hideable
      ? [{
          type: 'row',
          fields: [
            ...(anchor ? [anchorField()] : []),
            ...(hideable ? [hiddenField()] : []),
          ],
        } satisfies Field]
      : []),
  ]
  return {
    type: 'collapsible',
    label: L('Görünüm', 'Appearance'),
    admin: { initCollapsed: true },
    fields: [{ name: 'appearance', type: 'group', label: false, admin: { hideGutter: true }, fields }],
  }
}
