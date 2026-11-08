import type { CollapsibleField, Field, SelectField, SelectFieldSingleValidation } from 'payload'

import { MOTION_LABELS as M } from '@/lib/admin-i18n'

/**
 * V1 motion presets (plan-visual-editor §V1). Pure module: the Payload field factory (`blockMotion`), the
 * render plan (`resolveMotion`) and the admin preset cards share these constants, so values live in one place.
 *
 * Additive only: option values and defaults must never be renamed/removed (SQLite table rebuilds).
 * `appearance.animation` (`subtle|none`) stays the master switch: `none` turns every motion setting off.
 * Defaults (`auto` + `scroll` + `base` + `0` + `soft` + `tight`) render exactly the pre-V1 markup.
 */

export const MOTION_PRESETS = [
  'auto', 'none', 'fade', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'zoom-in', 'parallax-soft', 'stagger',
] as const
export const MOTION_TRIGGERS = ['scroll', 'scroll-progress', 'load', 'hover'] as const
export const MOTION_DURATIONS = ['fast', 'base', 'slow'] as const
export const MOTION_DELAYS = ['0', '100', '200', '300'] as const
export const MOTION_EASINGS = ['soft', 'standard', 'emphasized'] as const
export const MOTION_STAGGERS = ['none', 'tight', 'relaxed'] as const

export type MotionPreset = (typeof MOTION_PRESETS)[number]
export type MotionTrigger = (typeof MOTION_TRIGGERS)[number]
export type MotionDuration = (typeof MOTION_DURATIONS)[number]
export type MotionDelay = (typeof MOTION_DELAYS)[number]
export type MotionEasing = (typeof MOTION_EASINGS)[number]
export type MotionStagger = (typeof MOTION_STAGGERS)[number]
/** Rendered effect: `auto` resolves to the legacy `subtle` reveal. */
export type MotionEffect = Exclude<MotionPreset, 'auto'> | 'subtle'

export const MOTION_DURATION_MS: Record<MotionDuration, number> = { fast: 240, base: 560, slow: 800 }
export const MOTION_STAGGER_MS: Record<MotionStagger, number> = { none: 0, tight: 60, relaxed: 100 }
export const MOTION_EASING_VAR: Record<MotionEasing, string> = {
  soft: 'var(--ease-out-soft)',
  standard: 'var(--ease-standard)',
  emphasized: 'var(--ease-emphasized)',
}
/** Total stagger budget (plan: at most 4 steps, <= 300 ms). */
export const MOTION_STAGGER_BUDGET_MS = 300
export const MOTION_MAX_STEPS = 4

export const MOTION_DEFAULTS = {
  preset: 'auto',
  trigger: 'scroll',
  duration: 'base',
  delay: '0',
  easing: 'soft',
  stagger: 'tight',
  mobile: false,
} as const satisfies Record<string, string | boolean>

/** Presets that start hidden (opacity 0) or scaled: never allowed on LCP-relevant blocks. */
export const HIDING_PRESETS: readonly MotionEffect[] = ['fade', 'zoom-in', 'stagger']
/** Hero blocks own the page h1/LCP: only translate-only entrances and parallax are offered. */
export const HERO_PRESETS: readonly MotionPreset[] = ['auto', 'none', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'parallax-soft']
export const LCP_BLOCK_TYPES: readonly string[] = ['hero']

export type ResolvedMotion = {
  preset: MotionEffect
  trigger: MotionTrigger
  duration: MotionDuration
  delay: MotionDelay
  easing: MotionEasing
  stagger: MotionStagger
  /** Parallax also below 768 px. */
  mobile: boolean
  /** LCP protection applied: never starts below full opacity, never scales. */
  safe: boolean
}

type MotionInput = {
  preset?: string | null
  trigger?: string | null
  duration?: string | null
  delay?: string | null
  easing?: string | null
  stagger?: string | null
  mobile?: boolean | null
}
type BlockLike = { blockType: string; motion?: MotionInput | null; appearance?: { animation?: string | null } | null }

const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

export const MOTION_NONE: ResolvedMotion = { preset: 'none', trigger: 'scroll', duration: 'base', delay: '0', easing: 'soft', stagger: 'tight', mobile: false, safe: false }
export const MOTION_LEGACY: ResolvedMotion = { ...MOTION_NONE, preset: 'subtle' }

/**
 * Stored (possibly missing/legacy/invalid) motion -> render settings. Never throws.
 * Priority chain (first match wins): prefers-reduced-motion and html[data-motion=none] (CSS/observer) ->
 * `appearance.animation: none` -> `motion.preset`.
 * `protect`: the block is the page's first visible block or a hero (LCP candidate). There, hiding presets
 * (`fade`/`zoom-in`/`stagger`) become `slide-up` and every non-hover entrance is translate-only (`safe`).
 * The legacy `auto` scroll reveal stays as it was: the observer never hides elements already on screen.
 */
export function resolveMotion(block: BlockLike, options: { animation?: string; protect?: boolean } = {}): ResolvedMotion {
  const animation = options.animation ?? block.appearance?.animation
  if (animation === 'none') return MOTION_NONE
  const m = block.motion ?? {}
  const stored = pick(MOTION_PRESETS, m.preset, 'auto')
  if (stored === 'none') return MOTION_NONE
  let preset: MotionEffect = stored === 'auto' ? 'subtle' : stored
  const trigger = pick(MOTION_TRIGGERS, m.trigger, 'scroll')
  let safe = false
  if (options.protect && preset !== 'parallax-soft' && trigger !== 'hover' && !(preset === 'subtle' && trigger === 'scroll')) {
    safe = true
    if (HIDING_PRESETS.includes(preset)) preset = 'slide-up'
  }
  return {
    preset,
    trigger,
    duration: pick(MOTION_DURATIONS, m.duration, 'base'),
    delay: pick(MOTION_DELAYS, m.delay, '0'),
    easing: pick(MOTION_EASINGS, m.easing, 'soft'),
    stagger: pick(MOTION_STAGGERS, m.stagger, 'tight'),
    mobile: m.mobile === true,
    safe,
  }
}

/** Max stagger steps for an interval so steps * interval <= 300 ms (and <= 4 steps). */
export function maxStaggerSteps(stagger: MotionStagger): number {
  const ms = MOTION_STAGGER_MS[stagger]
  return ms ? Math.min(MOTION_MAX_STEPS, Math.floor(MOTION_STAGGER_BUDGET_MS / ms)) : 0
}

/**
 * Drizzle enum name for a motion select (`enum_<table>_motion_<key>`); shortened when over the 63 char
 * identifier limit, like `appearanceEnumName`. SQLite has no enum types: the name only exists in drizzle.
 */
export function motionEnumName(key: string) {
  return ({ tableName }: { tableName?: string }) => {
    const table = tableName ?? 'block'
    const full = `enum_${table}_motion_${key}`
    if (full.length <= 63) return full
    let hash = 5381
    for (const ch of table) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0
    const short = `enum_${table}_m_${key}`
    return short.length <= 63 ? short : `enum_${table.slice(0, 36)}_${hash.toString(36)}_m${key.slice(0, 4)}`
  }
}

const msg = (req: { i18n?: { language?: string } } | undefined, tr: string, en: string) =>
  req?.i18n?.language === 'en' ? en : tr

/** Hero blocks reject hiding presets (the renderer would downgrade them anyway). */
export const validateHeroPreset = ((value: unknown, { req }: { req?: { i18n?: { language?: string } } }): true | string => {
  if (value === null || value === undefined || (typeof value === 'string' && (HERO_PRESETS as readonly string[]).includes(value))) return true
  return msg(
    req,
    'Giriş (Hero) bloğunda bu efekt kullanılamaz: sayfa açılışını geciktirir. Kayma veya paralaks seçin.',
    'This effect is not allowed on a hero block (it delays the first paint). Choose a slide or parallax.',
  )
}) satisfies SelectFieldSingleValidation

const opts = <K extends string>(values: readonly K[], labels: Record<K, { tr: string; en: string }>) =>
  values.map((value) => ({ value, label: labels[value] }))

/**
 * "Hareket" collapsible holding the `motion` group, rendered next to "Görünüm". The preset uses the admin
 * card picker (`src/admin/fields/motion-preset-cards.tsx`, admin bundle only); details sit under "Gelişmiş".
 */
export function blockMotion(blockType: string, presetHooks?: SelectField['hooks']): CollapsibleField {
  const hero = LCP_BLOCK_TYPES.includes(blockType)
  const presets = hero ? HERO_PRESETS : MOTION_PRESETS
  const fields: Field[] = [
    {
      name: 'preset',
      type: 'select',
      enumName: motionEnumName('preset'),
      defaultValue: MOTION_DEFAULTS.preset,
      label: M.fields.preset,
      options: opts(MOTION_PRESETS, Object.fromEntries(MOTION_PRESETS.map((p) => [p, M.presets[p][0]])) as Record<MotionPreset, { tr: string; en: string }>),
      ...(hero ? { validate: validateHeroPreset } : {}),
      ...(presetHooks ? { hooks: presetHooks } : {}),
      admin: {
        components: { Field: '@/admin/fields/motion-preset-cards#MotionPresetCards' },
        custom: { presets },
      },
    },
    {
      type: 'collapsible',
      label: M.advanced,
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'trigger',
              type: 'select',
              enumName: motionEnumName('trigger'),
              defaultValue: MOTION_DEFAULTS.trigger,
              label: M.fields.trigger,
              options: opts(MOTION_TRIGGERS, M.triggers),
              admin: { isClearable: false, width: '50%', description: M.descriptions.trigger },
            },
            {
              name: 'duration',
              type: 'select',
              enumName: motionEnumName('duration'),
              defaultValue: MOTION_DEFAULTS.duration,
              label: M.fields.duration,
              options: opts(MOTION_DURATIONS, M.durations),
              admin: { isClearable: false, width: '50%' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'delay',
              type: 'select',
              enumName: motionEnumName('delay'),
              defaultValue: MOTION_DEFAULTS.delay,
              label: M.fields.delay,
              options: opts(MOTION_DELAYS, M.delays),
              admin: { isClearable: false, width: '33%' },
            },
            {
              name: 'easing',
              type: 'select',
              enumName: motionEnumName('easing'),
              defaultValue: MOTION_DEFAULTS.easing,
              label: M.fields.easing,
              options: opts(MOTION_EASINGS, M.easings),
              admin: { isClearable: false, width: '33%' },
            },
            {
              name: 'stagger',
              type: 'select',
              enumName: motionEnumName('stagger'),
              defaultValue: MOTION_DEFAULTS.stagger,
              label: M.fields.stagger,
              options: opts(MOTION_STAGGERS, M.staggers),
              admin: { isClearable: false, width: '33%', description: M.descriptions.stagger },
            },
          ],
        },
        {
          name: 'mobile',
          type: 'checkbox',
          defaultValue: MOTION_DEFAULTS.mobile,
          label: M.fields.mobile,
          admin: {
            description: M.descriptions.mobile,
            condition: (_data, siblingData) => (siblingData as { preset?: unknown } | undefined)?.preset === 'parallax-soft',
          },
        },
      ],
    },
  ]
  return {
    type: 'collapsible',
    label: M.panel,
    admin: { initCollapsed: true },
    fields: [{ name: 'motion', type: 'group', label: false, admin: { hideGutter: true }, fields }],
  }
}
