/** Match Container's 20/32px gutters, max widths and the surrounding grid gap. */
export function containerImageSizes(width: 'normal' | 'narrow' | 'wide' = 'normal', columns = 1, gap = 48) {
  const cap = { normal: 1200, narrow: 736, wide: 1360 }[width]
  const full = `min(100vw, ${cap}px)`
  const desktop = columns > 1 ? `calc((${full} - ${64 + gap * (columns - 1)}px) / ${columns})` : `calc(${full} - 64px)`
  return `(min-width: 1024px) ${desktop}, (min-width: 640px) calc(${full} - 64px), calc(100vw - 40px)`
}

export const CARD_IMAGE_SIZES = '(min-width: 1200px) 363px, (min-width: 1024px) calc((100vw - 112px) / 3), (min-width: 768px) calc((100vw - 88px) / 2), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)'
