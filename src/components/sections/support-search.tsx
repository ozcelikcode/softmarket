import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { localizedHref } from '@/i18n/paths'
import type { Locale } from '@/i18n/routing'
import { inputClass } from './support-filters'

export async function SupportSearch({ locale, query = '' }: { locale: Locale; query?: string }) {
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return (
    <form
      role="search"
      method="get"
      action={localizedHref('/ara', locale)}
      className="mb-8 max-w-3xl"
    >
      <label htmlFor="support-query" className="mb-2 block font-medium">
        {t('searchLabel')}
      </label>
      <div className="flex gap-3">
        <input
          className={inputClass}
          id="support-query"
          name="q"
          type="search"
          minLength={2}
          maxLength={120}
          defaultValue={query}
          aria-describedby="search-hint"
        />
        <Button type="submit">{t('search')}</Button>
      </div>
      <p id="search-hint" className="mt-2 text-small text-muted">
        {t('searchHint')}
      </p>
    </form>
  )
}
