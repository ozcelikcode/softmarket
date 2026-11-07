/*
 * Admin-editable accent color (SiteSettings.brand.accent). Pure functions shared by the
 * field validation (server, every write path incl. MCP/Local API) and the layout renderer.
 *
 * Rule (WCAG AA, 4.5:1): the entered color must work as-is in at least one site theme:
 *   - as text/links on that theme's bg and surface, and
 *   - under its own button text (white or near-black, whichever is stronger).
 * The other theme gets an automatically derived tone of the same hue (lighter on dark,
 * darker on light), and both themes get a derived hover tone that keeps the same rule.
 * A color that passes in neither theme (mid luminance band) is rejected.
 */

export const AA = 4.5

export const THEME_SURFACES = {
  dark: ['#0b0d10', '#13161b'],
  light: ['#f7f8fa', '#ffffff'],
} as const
export const TEXT_ON_ACCENT = ['#ffffff', '#0b0d10'] as const

export type Theme = keyof typeof THEME_SURFACES
export type AccentTokens = { accent: string; hover: string; contrast: string }
export type AccentResult =
  | { ok: true; dark: AccentTokens; light: AccentTokens; source: Theme[] }
  | { ok: false; reason: 'format' | 'contrast'; ratios?: Record<Theme, number> }

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** '#ABC' / ' #aabbcc ' -> '#aabbcc'; anything else -> null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (!HEX.test(v)) return null
  return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Best text color on the accent and its ratio. */
export function textOn(accent: string): { color: string; ratio: number } {
  return TEXT_ON_ACCENT.map((color) => ({ color, ratio: contrast(accent, color) }))
    .sort((a, b) => b.ratio - a.ratio)[0]
}

/** Lowest ratio of all checks for this theme (text on surfaces + button text on accent). */
export function themeRatio(accent: string, theme: Theme): number {
  return Math.min(...THEME_SURFACES[theme].map((s) => contrast(accent, s)), textOn(accent).ratio)
}

const passes = (accent: string, theme: Theme) => themeRatio(accent, theme) >= AA

/* HSL lightness steps keep the hue/saturation of the brand color. */
function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, s, l]
}
function fromHsl([h, s, l]: [number, number, number]): string {
  if (s === 0) return toHex([l, l, l].map((v) => v * 255))
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return toHex([hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map((v) => v * 255))
}
function shift(hex: string, delta: number): string {
  const [h, s, l] = toHsl(hex)
  return fromHsl([h, s, Math.min(1, Math.max(0, l + delta))])
}

/** Move lightness toward the theme's readable side until the theme rule passes. */
function adapt(hex: string, theme: Theme): string | null {
  const step = theme === 'dark' ? 0.01 : -0.01
  let current = hex
  for (let i = 0; i <= 100; i++) {
    if (passes(current, theme)) return current
    current = shift(current, step)
  }
  return null
}

function tokens(accent: string, theme: Theme): AccentTokens {
  // Hover: one visible step further from the background, falling back to the accent itself.
  const hover = shift(accent, theme === 'dark' ? 0.08 : -0.08)
  return {
    accent,
    hover: passes(hover, theme) && textOn(hover).color === textOn(accent).color ? hover : accent,
    contrast: textOn(accent).color,
  }
}

export function deriveAccent(value: unknown): AccentResult {
  const hex = normalizeHex(value)
  if (!hex) return { ok: false, reason: 'format' }
  const ratios = { dark: themeRatio(hex, 'dark'), light: themeRatio(hex, 'light') }
  const source = (['dark', 'light'] as const).filter((t) => ratios[t] >= AA)
  if (!source.length) return { ok: false, reason: 'contrast', ratios }
  const dark = adapt(hex, 'dark')
  const light = adapt(hex, 'light')
  if (!dark || !light) return { ok: false, reason: 'contrast', ratios }
  return { ok: true, dark: tokens(dark, 'dark'), light: tokens(light, 'light'), source: [...source] }
}

/** Payload field validation: empty = built-in palette; otherwise the rule above. */
export function validateAccent(value: unknown, language?: string): true | string {
  if (value === null || value === undefined || value === '') return true
  const result = deriveAccent(value)
  if (result.ok) return true
  const en = language === 'en'
  if (result.reason === 'format') return en ? 'Use a hex color such as #2f5fe0.' : '#2f5fe0 gibi bir hex renk girin.'
  const r = result.ratios!
  const tr = (n: number) => n.toFixed(2).replace('.', ',')
  return en
    ? `Insufficient contrast (WCAG AA needs 4.5:1): dark theme ${r.dark.toFixed(2)}:1, light theme ${r.light.toFixed(2)}:1. Choose a darker or lighter tone.`
    : `Kontrast yetersiz (WCAG AA en az 4,5:1): koyu tema ${tr(r.dark)}:1, açık tema ${tr(r.light)}:1. Daha koyu veya daha açık bir ton seçin.`
}

/** CSS custom properties for <html style>; globals.css maps them onto theme tokens. Empty when unset/invalid. */
export function accentStyle(value: unknown): Record<string, string> {
  const result = deriveAccent(value)
  if (!result.ok) return {}
  return {
    '--brand-dark-accent': result.dark.accent,
    '--brand-dark-accent-hover': result.dark.hover,
    '--brand-dark-accent-contrast': result.dark.contrast,
    '--brand-light-accent': result.light.accent,
    '--brand-light-accent-hover': result.light.hover,
    '--brand-light-accent-contrast': result.light.contrast,
  }
}
