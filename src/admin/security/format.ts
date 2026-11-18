/*
 * L6a display helpers (pure). The security center never shows more than is stored and never reconstructs anything:
 * hashes are shortened for display, `detail` is flattened to a small, redacted list of primitives.
 */

/** First characters of a stored hash, enough to compare rows by eye (the stored value is already a one-way HMAC). */
export function shortHash(value: string | null | undefined, length = 10): string {
  if (!value) return ''
  return value.length <= length ? value : `${value.slice(0, length)}…`
}

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/
const LICENSE_KEY_RE = /\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b/i
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/
const PEM_RE = /-----BEGIN [A-Z0-9 ]+-----/
const SENSITIVE_KEY_RE =
  /^key$|^fp$|secret|token|password|passwd|passphrase|signature|fingerprint|e-?mail|authorization|cookie|private_?key|public_?key|device_?key|signing_?key|api_?key|license_?key|thumbprint|ip_?hash|fp_?hash|nonce|lease|\b(?:jwt|jws)\b/i

function parseIpv4(raw: string): number | null {
  const parts = raw.split('.')
  if (parts.length !== 4) return null
  let num = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    num = ((num << 8) | n) >>> 0
  }
  return num
}

function parseIpv6Words(raw: string): number[] | null {
  if (!raw.includes(':')) return null
  const halves = raw.split('::')
  if (halves.length > 2) return null

  const parseSide = (side: string, allowV4Tail: boolean): number[] | null => {
    if (!side) return []
    const groups = side.split(':')
    const out: number[] = []
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!
      if (allowV4Tail && i === groups.length - 1 && g.includes('.')) {
        const v4 = parseIpv4(g)
        if (v4 === null) return null
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff)
      } else {
        if (!/^[0-9a-f]{1,4}$/i.test(g)) return null
        out.push(Number.parseInt(g, 16))
      }
    }
    return out
  }

  const left = parseSide(halves[0]!, halves.length === 1)
  if (!left) return null
  if (halves.length === 1) return left.length === 8 ? left : null

  const right = parseSide(halves[1]!, true)
  if (!right) return null
  const missing = 8 - (left.length + right.length)
  if (missing < 1) return null
  return [...left, ...Array<number>(missing).fill(0), ...right]
}

function hasUnsafeIpv4(text: string): boolean {
  const re = /(?:^|[^0-9.])((?:\d{1,3}\.){3}\d{1,3})(?:\/([^\s,;\])"']+))?(?=$|[^0-9.])/g
  for (const m of text.matchAll(re)) {
    const ip = parseIpv4(m[1]!)
    if (ip === null) continue
    const maskStr = m[2]
    if (maskStr === undefined) return true
    if (!/^\d{1,2}$/.test(maskStr)) return true
    const mask = Number(maskStr)
    if (mask < 0 || mask >= 32) return true
    const hostMask = mask === 0 ? 0xffffffff : (0xffffffff >>> mask) >>> 0
    if ((ip & hostMask) !== 0) return true
  }
  return false
}

function hasUnsafeIpv6(text: string): boolean {
  const re = /(?:^|[^0-9a-fA-F:])([0-9a-fA-F:]{2,}(?:\.\d{1,3}){0,3})(?:\/([^\s,;\])"']+))?(?=$|[^0-9a-fA-F:])/g
  for (const m of text.matchAll(re)) {
    const words = parseIpv6Words(m[1]!)
    if (!words) continue
    const maskStr = m[2]
    if (maskStr === undefined) return true
    if (!/^\d{1,3}$/.test(maskStr)) return true
    const mask = Number(maskStr)
    if (mask < 0 || mask >= 128) return true
    for (let w = 0; w < 8; w++) {
      const bitStart = w * 16
      if (mask <= bitStart) {
        if (words[w] !== 0) return true
      } else if (mask < bitStart + 16) {
        const keep = mask - bitStart
        const hostMask = (1 << (16 - keep)) - 1
        if ((words[w]! & hostMask) !== 0) return true
      }
    }
  }
  return false
}

export const DETAIL_LIMITS = { maxEntries: 20, maxKeyLength: 40, maxValueLength: 120 } as const

export type DetailEntry = { key: string; value: string; redacted: boolean }
export type SafeDetail = { entries: DetailEntry[]; truncated: boolean }

/**
 * `security-events.detail` is allow-listed and PII-free by the writer (plan §4.4), but the view does not rely on it:
 * only top-level primitives are shown, long values are cut, and anything that looks like an e-mail address, a full IP
 * address (including compressed IPv6 or `/32` `/128` host CIDRs), a license key, a JWT/PEM or a secret-ish key name
 * is replaced by a redaction marker. Valid network prefixes (`203.0.113.0/24`, `2001:db8:1::/48`) stay.
 */
export function safeDetail(detail: unknown): SafeDetail {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return { entries: [], truncated: false }
  const all = Object.entries(detail as Record<string, unknown>).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
  const entries = all.slice(0, DETAIL_LIMITS.maxEntries).map(([rawKey, v]): DetailEntry => {
    const key = rawKey.slice(0, DETAIL_LIMITS.maxKeyLength)
    const text = String(v)
    const redacted =
      SENSITIVE_KEY_RE.test(rawKey) ||
      EMAIL_RE.test(text) ||
      LICENSE_KEY_RE.test(text) ||
      JWT_RE.test(text) ||
      PEM_RE.test(text) ||
      hasUnsafeIpv4(text) ||
      hasUnsafeIpv6(text)
    return { key, value: redacted ? '' : text.length > DETAIL_LIMITS.maxValueLength ? `${text.slice(0, DETAIL_LIMITS.maxValueLength)}…` : text, redacted }
  })
  return { entries, truncated: all.length > DETAIL_LIMITS.maxEntries }
}

/** Compact absolute timestamp in UTC (the admin may be anywhere; audit work needs an unambiguous clock). */
export function formatInstant(value: string | null | undefined, lang: 'tr' | 'en'): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const text = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(d)
  return `${text} UTC`
}

const normalizeAdminBase = (adminRoute: string): string => (adminRoute === '/' ? '' : adminRoute.replace(/\/+$/, ''))

/** Admin-route document link; ids are numeric Payload ids, never user text. */
export function documentHref(adminRoute: string, collection: string, id: number | string): string {
  return `${normalizeAdminBase(adminRoute)}/collections/${encodeURIComponent(collection)}/${encodeURIComponent(String(id))}`
}

export function collectionHref(adminRoute: string, collection: string): string {
  return `${normalizeAdminBase(adminRoute)}/collections/${encodeURIComponent(collection)}`
}
