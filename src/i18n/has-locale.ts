/**
 * Same as next-intl's `hasLocale`. Server modules must not import the `next-intl` root entry: its
 * react-server build re-exports NextIntlClientProvider, which registers a client reference and ships
 * use-intl (formatters, error codes) to every page even when no provider is rendered.
 */
export function hasLocale<T extends string>(locales: readonly T[], candidate: unknown): candidate is T {
  return typeof candidate === 'string' && (locales as readonly string[]).includes(candidate)
}
