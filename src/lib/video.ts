/** Map a pasted YouTube/Vimeo URL to a privacy-friendly embed URL. Anything else returns null. */
export function toEmbedUrl(value: string | null | undefined): string | null {
  if (!value) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.replace(/^www\./, '')
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{11}$/.test(s) ? s : null)
  if (host === 'youtu.be') {
    const v = id(url.pathname.slice(1))
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const embed = /^\/embed\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)
    const v = embed ? id(embed[1]) : url.pathname === '/watch' ? id(url.searchParams.get('v')) : null
    return v ? `https://www.youtube-nocookie.com/embed/${v}` : null
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const path = host === 'player.vimeo.com' ? /^\/video\/([1-9]\d{4,11})\/?$/ : /^\/([1-9]\d{4,11})\/?$/
    const v = path.exec(url.pathname)?.[1]
    return v ? `https://player.vimeo.com/video/${v}?dnt=1` : null
  }
  return null
}
