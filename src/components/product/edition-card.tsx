import { Check } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Edition } from '@/payload-types'

/** Quote target using a stable edition code across locales. */
export function editionHref(edition: Pick<Edition, 'sku'>, productSlug: string) {
  return `/teklif-iste?urun=${encodeURIComponent(productSlug)}&surum=${encodeURIComponent(edition.sku)}`
}

export async function EditionCard({ edition, productSlug, locale }: { edition: Edition; productSlug: string; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'product' })
  const action = editionHref(edition, productSlug)
  const facts = [
    edition.licenseType === 'perpetual' ? t('perpetual') : t('subscription'),
    edition.licenseType === 'subscription' && edition.durationMonths ? t('months', { count: edition.durationMonths }) : null,
    edition.seats ? t('seats', { count: edition.seats }) : null,
  ].filter(Boolean) as string[]
  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-7">
      <div className="flex flex-wrap items-center gap-2">
        {facts.map((f) => <Badge key={f}>{f}</Badge>)}
      </div>
      <h3 className="mt-5 text-h3 text-text">{edition.title}</h3>
      {edition.description ? <p className="mt-2 text-small text-muted">{edition.description}</p> : null}
      {edition.highlights?.length ? (
        <ul className="mt-6 flex-1 space-y-2.5 border-t border-border pt-6">
          {edition.highlights.map((h, i) => (
            <li key={h.id ?? i} className="flex gap-2.5 text-small text-text">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              {h.text}
            </li>
          ))}
        </ul>
      ) : <div className="flex-1" />}
      <Button asChild size="lg" variant="secondary" className="mt-8 w-full">
        <AppLink href={action} locale={locale}>{t('quote')}</AppLink>
      </Button>
    </article>
  )
}
