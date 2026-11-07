import { randomBytes as nodeRandomBytes } from 'crypto'

/**
 * Unambiguous alphabet: no 0/O, 1/I/L, U (avoids accidental words), 30 symbols.
 * 25 symbols * log2(30) ≈ 122.7 bits of entropy with the default format.
 */
export const LICENSE_KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

export type LicenseKeyOptions = {
  groups?: number
  groupLength?: number
  separator?: string
  /** Injectable CSPRNG (tests). Must return `size` cryptographically random bytes. */
  randomBytes?: (size: number) => Uint8Array
}

const DEFAULTS = { groups: 5, groupLength: 5, separator: '-' } as const

// Largest multiple of alphabet length <= 256; bytes >= this are rejected to avoid modulo bias.
const REJECTION_LIMIT = 256 - (256 % LICENSE_KEY_ALPHABET.length)

/** Generates a key like `7KQ9M-XH4TB-...` using rejection sampling (uniform, unbiased). */
export const generateLicenseKey = (options: LicenseKeyOptions = {}): string => {
  const groups = options.groups ?? DEFAULTS.groups
  const groupLength = options.groupLength ?? DEFAULTS.groupLength
  const separator = options.separator ?? DEFAULTS.separator
  const random = options.randomBytes ?? nodeRandomBytes

  if (!Number.isInteger(groups) || groups < 1) throw new RangeError('groups must be a positive integer')
  if (!Number.isInteger(groupLength) || groupLength < 1) {
    throw new RangeError('groupLength must be a positive integer')
  }

  const total = groups * groupLength
  const chars: string[] = []
  while (chars.length < total) {
    const bytes = random(Math.max(16, (total - chars.length) * 2))
    for (const byte of bytes) {
      if (byte >= REJECTION_LIMIT) continue
      chars.push(LICENSE_KEY_ALPHABET[byte % LICENSE_KEY_ALPHABET.length])
      if (chars.length === total) break
    }
  }

  const parts: string[] = []
  for (let i = 0; i < groups; i++) parts.push(chars.slice(i * groupLength, (i + 1) * groupLength).join(''))
  return parts.join(separator)
}

/** Upper-cases, trims, removes whitespace and normalises dash variants. */
export const normalizeLicenseKey = (input: string): string =>
  input
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '')
    .replace(/[‐-―]/g, '-')

const DEFAULT_PATTERN = new RegExp(
  `^[${LICENSE_KEY_ALPHABET}]{${DEFAULTS.groupLength}}(?:-[${LICENSE_KEY_ALPHABET}]{${DEFAULTS.groupLength}}){${DEFAULTS.groups - 1}}$`,
)

/** Validates the default `XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` format (after normalisation). */
export const isValidLicenseKeyFormat = (input: string): boolean =>
  DEFAULT_PATTERN.test(normalizeLicenseKey(input))
