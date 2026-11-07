/** Map a pasted YouTube/Vimeo URL to a privacy-friendly embed URL. Anything else returns null. */
export function toEmbedUrl(value: string | null | undefined): string | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.replace(/^www\./, '')
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,20}$/.test(s) ? s : null)
  if (host === 'youtu.be') {
    const v = id(url.pathname.slice(1))
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const v = parts[0] === 'embed' ? id(parts[1]) : parts[0] === 'watch' ? id(url.searchParams.get('v')) : null
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean)
    const v = parts.find((p) => /^\d{5,12}$/.test(p))
    return v ? `https://player.vimeo.com/video/${v}?dnt=1` : null
  }
  return null
}
