import { describe, expect, it } from 'vitest'

import { linkField } from '@/fields/link'
import { isAllowedLinkUrl, isDangerousLinkUrl, safeHref } from '@/lib/safe-href'

/* G1: server rule for `linkField().url` (shared with render's safeHref). */
const urlValidate = (linkField().fields.find((f) => 'name' in f && f.name === 'url') as { validate: (v: unknown, o: object) => true | string }).validate

describe('link address validation', () => {
  it('rejects script/data schemes (also obfuscated) and protocol-relative addresses, even when unchanged', () => {
    for (const url of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:x', 'java\nscript:x', 'data:text/html,x', 'vbscript:x', '//evil.example', '\\\\evil', '/\\evil']) {
      expect(isDangerousLinkUrl(url), url).toBe(true)
      expect(isAllowedLinkUrl(url, url), url).toBe(false)
    }
  })
  it('accepts http(s), mailto, tel, site paths, anchors and empty values', () => {
    for (const url of ['https://example.com/x?y=1', 'http://example.com', 'mailto:info@example.com', 'tel:+902120000000', '/tr/iletisim', '#form', '?q=1', '', null, undefined]) {
      expect(isAllowedLinkUrl(url), String(url)).toBe(true)
    }
  })
  it('rejects schemeless and other invalid values unless they are the unchanged stored value', () => {
    for (const url of ['www.example.com', 'ftp://example.com', 'mailto:[COMPANY EMAIL]', 'https://exa mple.com']) {
      expect(isAllowedLinkUrl(url), url).toBe(false)
      expect(isAllowedLinkUrl(url, url), url).toBe(true)
    }
    expect(isAllowedLinkUrl(42)).toBe(false)
  })
  it('the linkField url validator returns a message for invalid values', () => {
    expect(urlValidate('https://example.com', {})).toBe(true)
    expect(urlValidate('javascript:alert(1)', {})).toMatch(/javascript:/)
  })
  it('rejects whitespace, control, encoded scheme and Unicode lookalike bypasses at render', () => {
    for (const url of [
      '\u0000javascript:alert(1)', '\u001fJaVaScRiPt:alert(1)', 'java\r\nscript:alert(1)',
      '\u00a0//evil.example', '\u2003javascript:alert(1)', '\\evil.example', '/\\evil.example',
      'javascript&#58;alert(1)', '&#106;avascript:alert(1)', 'java&#x09;script:alert(1)',
      'javascript%3Aalert(1)', '%2f%2fevil.example', '\u200bjavascript:alert(1)',
      'ｊavascript:alert(1)', 'javascript：alert(1)', '／／evil.example',
    ]) {
      expect(safeHref(url), url).toBeNull()
      expect(isAllowedLinkUrl(url), url).toBe(false)
    }
    // Unicode hostnames and escaped text within a local path are ordinary browser navigation.
    for (const url of ['https://bücher.example/guide', '/docs/javascript%3Aexample', '#javascript:example']) {
      expect(safeHref(url), url).toBe(url)
    }
  })
})
