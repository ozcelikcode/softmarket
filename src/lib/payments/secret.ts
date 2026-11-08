const REDACTED = '[REDACTED]'

/**
 * Wraps a secret so that String(), JSON.stringify(), template literals, console.log and
 * util.inspect never print it. Only `reveal()` returns the value (call it at the HMAC/HTTP edge).
 */
export class SecretValue {
  readonly #value: string

  constructor(value: string) {
    this.#value = value
  }

  reveal(): string {
    return this.#value
  }

  toString(): string {
    return REDACTED
  }

  toJSON(): string {
    return REDACTED
  }

  [Symbol.toPrimitive](): string {
    return REDACTED
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED
  }
}

/** Treat empty or `CHANGE_` placeholders as "not configured" (project-wide convention). */
export function readSecret(raw: string | undefined): SecretValue | undefined {
  const value = raw?.trim()
  if (!value || value.startsWith('CHANGE_')) return undefined
  return new SecretValue(value)
}
