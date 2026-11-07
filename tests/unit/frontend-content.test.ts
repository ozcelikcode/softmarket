import { describe, expect, it } from 'vitest'

import { jsonLdString } from '@/lib/seo'
import { toEmbedUrl } from '@/lib/video'

describe('video embeds', () => {
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
