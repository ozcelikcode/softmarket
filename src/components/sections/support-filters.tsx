import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { localizedHref } from '@/i18n/paths'
import type { Locale } from '@/i18n/routing'
import type { SupportProduct } from '@/lib/support'

export const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2.5 text-text focus-visible:outline-2 focus-visible:outline-accent'
export async function SupportFilters({
  locale,
  path,
  products,
  product,
  releases,
  release,
  os,
  category,
}: {
  locale: Locale
  path: string
  products: SupportProduct[]
  product?: string
  releases?: { id: number; version: string }[]
  release?: string
  os?: string
  category?: string
}) {
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return (
    <form
      method="get"
      action={localizedHref(path, locale)}
      className="mb-10 flex flex-wrap items-end gap-4"
    >
      <label className="min-w-48 flex-1">
        {t('product')}
        <select name="urun" defaultValue={product ?? ''} className={inputClass}>
          <option value="">{t('allProducts')}</option>
          {products.map((p) => (
            <option key={p.id} value={p.slug!}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      {releases ? (
        <label className="min-w-40 flex-1">
          {t('release')}
          <select name="surum" defaultValue={release ?? ''} className={inputClass}>
            <option value="">{t('allReleases')}</option>
            {releases.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.version}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {os !== undefined ? (
        <label className="min-w-40 flex-1">
          {t('os')}
          <select name="os" defaultValue={os} className={inputClass}>
            <option value="">{t('allOs')}</option>
            {['windows', 'macos', 'linux', 'web', 'android', 'ios', 'other'].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {category !== undefined ? (
        <label className="min-w-40 flex-1">
          {t('category')}
          <select name="kategori" defaultValue={category} className={inputClass}>
            <option value="">{t('allCategories')}</option>
            {(['general', 'licensing', 'billing', 'technical'] as const).map((v) => (
              <option key={v} value={v}>
                {t(v)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <Button type="submit">{t('filter')}</Button>
    </form>
  )
}
