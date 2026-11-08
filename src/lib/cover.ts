/** FNV-1a: stable per-card seed from the link (slug) so placeholder covers differ but never flicker. */
function seedOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

const GLYPHS = [
  'M3 5.5h10M3 10.5h10',
  'M3 12l3.5-4 3 2.5L13 4',
  'M8 3v10M3 8h10',
  'M4 4h8v8H4z',
  'M3 8a5 5 0 0 1 10 0',
  'M3 4l5 8 5-8',
]

/** Deterministic CSS-only cover variant (glow position, hatch angle/density, glyph) from the slug hash. */
export function placeholderCover(seed: string) {
  const h = seedOf(seed)
  const x = 15 + (h % 71)
  const y = 10 + ((h >>> 7) % 61)
  const angle = [30, 60, 120, 150, 90, 15][(h >>> 13) % 6]
  const gap = 10 + ((h >>> 17) % 3) * 4
  const strength = 24 + ((h >>> 21) % 4) * 7
  return {
    glyph: GLYPHS[(h >>> 3) % GLYPHS.length],
    style: {
      backgroundImage: `radial-gradient(ellipse at ${x}% ${y}%, color-mix(in oklab, var(--accent) ${strength}%, transparent), transparent 62%), repeating-linear-gradient(${angle}deg, color-mix(in oklab, var(--border-strong) 35%, transparent) 0 1px, transparent 1px ${gap}px)`,
    },
  }
}

