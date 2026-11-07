import { describe, expect, it } from 'vitest'

import { jsonLdString } from '@/lib/seo'
import { toEmbedUrl } from '@/lib/video'

describe('video embeds', () => {
  it.each([
    'data:text/html,video', 'https://youtu.be/abcdef', 'https://youtu.be/abcdefghijkl',
    'https://youtube.com/embed/dQw4w9WgXcQ/extra', 'https://youtube.com/redirect?v=dQw4w9WgXcQ',
    'https://youtube.com:444/watch?v=dQw4w9WgXcQ', 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vimeo.com/redirect/123456789', 'https://player.vimeo.com/other/123456789',
    'https://vimeo.com/00000000', 'https://vimeo.com/123456789/extra',
    'https://evil.test@youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ%3fautoplay=1',
  ])('rejects malformed IDs and noncanonical provider paths %s', (input) => expect(toEmbedUrl(input)).toBeNull())

  it('discards caller-supplied embed parameters', () => {
    expect(toEmbedUrl('https://youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1&origin=https://evil.test&redirect=https://evil.test'))
      .toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(toEmbedUrl('https://player.vimeo.com/video/123456789?dnt=0&url=https://evil.test'))
      .toBe('https://player.vimeo.com/video/123456789?dnt=1')
  })
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'],
    ['https://vimeo.com/123456789', 'https://player.vimeo.com/video/123456789?dnt=1'],
  ])('maps %s', (input, out) => expect(toEmbedUrl(input)).toBe(out))

  it.each(['http://youtu.be/dQw4w9WgXcQ', 'https://evil.test/embed/abc', 'javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', ''])(
    'rejects %j', (input) => expect(toEmbedUrl(input)).toBeNull())
})

describe('json-ld', () => {
  it('escapes script terminators', () => {
    expect(jsonLdString({ a: '</script><script>x' })).not.toContain('</script>')
  })
})
