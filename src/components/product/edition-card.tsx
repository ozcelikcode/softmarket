import { Check } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { AppLink } from '@/components/ui/app-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { QUOTE_ACTION, type EditionAction } from '@/lib/payments/actions'
import { checkoutHref, displayMinor, formatMoney, splitPrices, taxLabelKey } from '@/lib/payments/format'
import type { Edition } from '@/payload-types'

/** Quote target using a stable edition code across locales. */
export function editionHref(edition: Pick<Edition, 'sku'>, productSlug: string) {
  return `/teklif-iste?urun=${encodeURIComponent(productSlug)}&surum=${encodeURIComponent(edition.sku)}`
}

/**
 * `action` (P3, `resolveProductActions`) decides the footer: `quote` (default, and every quote-only site) renders the
 * pre-P3 markup unchanged; `buy` adds the price, "Satın al" and a secondary "Kurumsal teklif iste" link. "Teklif İste"
 * is never removed. Without a checkout (P5 flag off) the buy button is disabled and has no href.
 */
export async function EditionCard({ edition, productSlug, locale, action = QUOTE_ACTION }: { edition: Edition; productSlug: string; locale: string; action?: EditionAction }) {
  const t = await getTranslations({ locale, namespace: 'product' })
  const quoteHref = editionHref(edition, productSlug)
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
      {action.kind === 'buy' ? <BuyFooter action={action} sku={edition.sku} quoteHref={quoteHref} locale={locale} t={t} /> : (
        <Button asChild size="lg" variant="secondary" className="mt-8 w-full">
          <AppLink href={quoteHref} locale={locale}>{t('quote')}</AppLink>
        </Button>
      )}
    </article>
  )
}

type T = Awaited<ReturnType<typeof getTranslations<'product'>>>

function BuyFooter({ action, sku, quoteHref, locale, t }: { action: Extract<EditionAction, { kind: 'buy' }>; sku: string; quoteHref: string; locale: string; t: T }) {
  const split = splitPrices(action.prices, locale)
  if (!split) return null
  const { primary, others } = split
  return (
    <>
      <div className="mt-6 border-t border-border pt-6" data-edition-price="">
        <p className="text-h3 text-text">{formatMoney(displayMinor(primary, action.taxMode), primary.currency, locale)}</p>
        <p className="mt-1 text-small text-muted">{t(taxLabelKey(primary, action.taxMode))}</p>
        {others.length ? (
          <p className="mt-2 text-small text-muted">
            {others.map((p) => `${formatMoney(displayMinor(p, action.taxMode), p.currency, locale)} (${t(taxLabelKey(p, action.taxMode))})`).join(' · ')}
          </p>
        ) : null}
      </div>
      {action.checkout ? (
        <Button asChild size="lg" className="mt-6 w-full"><AppLink href={checkoutHref(sku)} locale={locale}>{t('buy')}</AppLink></Button>
      ) : (
        <>
          <Button type="button" size="lg" disabled aria-disabled="true" className="mt-6 w-full">{t('buy')}</Button>
          <p className="mt-2 text-center text-small text-muted">{t('buySoon')}</p>
        </>
      )}
      <Button asChild variant="link" className="mt-3 w-full">
        <AppLink href={quoteHref} locale={locale}>{t('corporateQuote')}</AppLink>
      </Button>
    </>
  )
}
