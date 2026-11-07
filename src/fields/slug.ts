import type { FieldHook, TextField, Validate, Where } from 'payload'

import { SLUG_PATTERN, slugify } from '@/lib/slugify'

type SlugFieldOptions = {
  /** Field the slug is derived from when left empty. */
  source?: string
  /**
   * Relationship field name that scopes uniqueness (e.g. docs are unique per product).
   * When set, validation checks (scope, locale); docs also have a migration-managed DB index.
   * When unset, a DB unique index on (slug, _locale) is used.
   */
  scope?: string
  localized?: boolean
  overrides?: { admin?: TextField['admin']; label?: string; required?: boolean }
}

const formatSlug =
  (source: string): FieldHook =>
  ({ value, data, originalDoc }) => {
    if (typeof value === 'string' && value.trim().length > 0) return slugify(value)
    const fallback = data?.[source] ?? originalDoc?.[source]
    if (typeof fallback === 'string' && fallback.trim().length > 0) return slugify(fallback)
    return value
  }

const relId = (value: unknown): unknown =>
  value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : value

const validateSlug =
  (scope?: string): Validate<string | null | undefined, unknown, unknown, TextField> =>
  async (value, { req, data, id, collectionSlug }) => {
    if (value === null || value === undefined || value === '') return true
    if (!SLUG_PATTERN.test(value)) {
      return 'Slug yalnızca küçük harf, rakam ve tire içerebilir / Slug may only contain lowercase letters, digits and hyphens.'
    }
    if (!scope || !collectionSlug) return true

    const scopeValue = relId((data as Record<string, unknown> | undefined)?.[scope])
    const conditions: Where[] = [{ slug: { equals: value } }]
    conditions.push(
      scopeValue === undefined || scopeValue === null
        ? { [scope]: { exists: false } }
        : { [scope]: { equals: scopeValue } },
    )
    if (id !== undefined && id !== null) conditions.push({ id: { not_equals: id } })

    // Payload 3.85 count does not forward locale to the SQLite adapter.
    // A bounded find preserves locale and checks the same uniqueness invariant.
    const existing = await req.payload.find({
      collection: collectionSlug as Parameters<typeof req.payload.count>[0]['collection'],
      where: { and: conditions },
      limit: 1,
      depth: 0,
      select: { slug: true },
      locale: req.locale && req.locale !== 'all' ? req.locale : undefined,
      overrideAccess: true,
      req,
    })
    return existing.docs.length === 0
      ? true
      : 'Bu slug bu kapsamda zaten kullanılıyor / This slug is already used in this scope.'
  }

/**
 * Localized slug field. Auto-generated from `source` when empty, normalised with `slugify`,
 * unique per locale (DB index) or per (scope, locale) when `scope` is given.
 */
export const slugField = ({
  source = 'title',
  scope,
  localized = true,
  overrides = {},
}: SlugFieldOptions = {}): TextField => ({
  name: 'slug',
  type: 'text',
  localized,
  index: true,
  unique: scope ? false : true,
  validate: validateSlug(scope),
  label: overrides.label,
  required: overrides.required,
  admin: overrides.admin ?? {
    position: 'sidebar',
    description: `Boş bırakılırsa "${source}" alanından üretilir. / Generated from "${source}" when empty.`,
  },
  hooks: {
    beforeValidate: [formatSlug(source)],
  },
})
