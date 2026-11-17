import { readPaymentsEnv, type PaymentsEnvConfig } from './env'
import { computeCommerceState } from './commerce-state'
import { resolveEditionOffer } from './mode'
import { CHECKOUT_READY } from './flags'
import { evaluateLegal, type LegalFact } from './legal'
import { readVatSettings } from './settings'
import { CURRENCIES } from './types'

/**
 * Admin readiness checklist for site-settings "Satış ve ödeme" (pure). Read-only information: it never shows
 * secret values, only configured/missing, the source (server/panel/none) and the SANDBOX/LIVE environment.
 */
export type ReadinessLevel = 'ok' | 'missing' | 'info'
export type ReadinessItem = { id: string; level: ReadinessLevel; label: { tr: string; en: string }; detail?: { tr: string; en: string } }

/** One published sales legal page (`pages.commerceLegal` set) per locale, with its draft-banner/placeholder state. */
export type LegalPageFact = LegalFact
export type ReadinessInput = {
  env: Record<string, string | undefined>
  siteSettings: unknown
  /** Editions as stored (admin read). */
  editions: unknown[]
  /** Pages marked with `commerceLegal`, per locale (see `readLegalFacts`). */
  legalPages: LegalPageFact[]
  /** Effective provider credentials (env + admin panel, `resolvePaymentsConfig`); omitted = env only. */
  paymentsConfig?: PaymentsEnvConfig
  /** Where SMTP comes from (env / admin panel / none); omitted = env check only. */
  smtpSource?: 'env' | 'panel' | 'none'
  /** Labels of missing company facts (site-settings); omitted = not checked. */
  companyMissing?: { tr: string; en: string }[]
}

const prop = (obj: unknown, key: string): unknown =>
  obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined
const item = (id: string, ok: boolean, tr: string, en: string, detail?: { tr: string; en: string }): ReadinessItem => ({
  id, level: ok ? 'ok' : 'missing', label: { tr, en }, ...(detail ? { detail } : {}),
})

export function isSmtpConfigured(env: Record<string, string | undefined>): boolean {
  const host = env.SMTP_HOST?.trim()
  return Boolean(host && !host.startsWith('CHANGE_') && env.SMTP_FROM)
}

export function buildReadiness(input: ReadinessInput): { items: ReadinessItem[]; environment: 'sandbox' | 'live' | 'mixed' | null; ready: boolean } {
  const cfg = input.paymentsConfig ?? readPaymentsEnv(input.env)
  const commerce = prop(input.siteSettings, 'commerce')
  const providerEnabled = (id: 'iyzico' | 'stripe') => prop(prop(prop(commerce, 'providers'), id), 'enabled') === true
  const iyzicoOn = providerEnabled('iyzico')
  const stripeOn = providerEnabled('stripe')
  const vat = readVatSettings(input.siteSettings)
  const vatCurrencies = CURRENCIES.filter((c) => vat[c])

  const buyEditions = input.editions.filter((e) => prop(e, 'saleMode') === 'buy')
  const legal = evaluateLegal(input.legalPages)
  const state = computeCommerceState({ env: input.env, siteSettings: input.siteSettings, legalReady: legal.ready, paymentsConfig: cfg })
  // Readiness also applies before switching modes; validate the same currency/VAT/provider path as the page.
  const pricedBuy = buyEditions.filter((edition) => resolveEditionOffer({
    gate: { capability: true, siteMode: 'payments', checkoutOpen: true }, edition,
    vatSettings: vat, availableProviders: state.availableProviders,
    stripeEnabled: state.stripeEnabled, stripeCurrencies: state.stripeCurrencies,
  }).kind === 'buy')

  const legalKinds = Object.values(legal.kinds)
  const approvedFacts = input.legalPages.filter((f) => f.kind && f.approved === true).length
  const SOURCE = { env: { tr: 'sunucu', en: 'server' }, panel: { tr: 'panel', en: 'panel' }, none: { tr: 'yok', en: 'none' } } as const
  const sources = cfg.sources ?? { iyzico: cfg.iyzico ? 'env' : 'none', stripe: cfg.stripe ? 'env' : 'none' }
  const sourceText = (lang: 'tr' | 'en') => `iyzico: ${SOURCE[sources.iyzico][lang]}${cfg.iyzico ? ` (${cfg.iyzico.env === 'live' ? (lang === 'en' ? 'live' : 'canlı') : 'test'})` : ''} · Stripe: ${SOURCE[sources.stripe][lang]}`
  const issueText = cfg.issues.length ? { tr: ` · eksik/geçersiz: ${cfg.issues.join(', ')}`, en: ` · missing/invalid: ${cfg.issues.join(', ')}` } : { tr: '', en: '' }
  const smtpOk = input.smtpSource ? input.smtpSource !== 'none' : isSmtpConfigured(input.env)
  const companyMissing = input.companyMissing

  const environments = new Set([
    ...(iyzicoOn && cfg.iyzico ? [cfg.iyzico.env] : []),
    ...(stripeOn && cfg.stripe ? [cfg.stripe.env] : []),
  ])
  const environment = environments.size > 1 ? 'mixed' as const : [...environments][0] ?? null
  const items: ReadinessItem[] = [
    item('capability', cfg.capability, 'Sunucuda PAYMENTS_ENABLED=true', 'PAYMENTS_ENABLED=true on the server'),
    item('provider-env', Boolean(cfg.iyzico || cfg.stripe), 'En az bir sağlayıcının anahtarları tanımlı (Entegrasyon ayarları veya sunucu)',
      'At least one provider has its keys set (Integration settings or server)',
      { tr: `${sourceText('tr')}${issueText.tr}`, en: `${sourceText('en')}${issueText.en}` }),
    item('provider-enabled', (iyzicoOn && Boolean(cfg.iyzico)) || (stripeOn && Boolean(cfg.stripe)),
      'Tanımlı bir sağlayıcı site ayarlarında açık', 'A configured provider is enabled in site settings'),
    item('vat', vatCurrencies.length > 0, 'En az bir para biriminde KDV kuralı',
      'A VAT rule for at least one currency',
      { tr: vatCurrencies.length ? `Hazır: ${vatCurrencies.join(', ')}` : 'Hiçbiri hazır değil', en: vatCurrencies.length ? `Ready: ${vatCurrencies.join(', ')}` : 'None ready' }),
    item('buy-editions', pricedBuy.length > 0, 'Fiyatı girilmiş "Satın al" sürümü', 'A "Buy online" edition with a price',
      { tr: `${pricedBuy.length} hazır, ${buyEditions.length - pricedBuy.length} kullanılabilir fiyatı yok`, en: `${pricedBuy.length} ready, ${buyEditions.length - pricedBuy.length} without a usable price` }),
    item('legal', legal.ready, 'Satış yasal sayfaları yayında, taslak değil ve hukukçu onaylı, TR ve EN (mesafeli satış, ön bilgilendirme, iade)',
      'Sales legal pages published, not draft and lawyer-approved, TR and EN (distance sales, pre-information, refund)',
      { tr: `${legalKinds.filter(Boolean).length}/3 hazır · hukukçu onaylı sürüm: ${approvedFacts}/6`, en: `${legalKinds.filter(Boolean).length}/3 ready · lawyer-approved versions: ${approvedFacts}/6` }),
    ...(companyMissing ? [item('company', companyMissing.length === 0, 'Şirket bilgileri tam (Site ayarları › Şirket ve iletişim)',
      'Company details complete (Site settings › Company & contact)',
      companyMissing.length ? { tr: `Eksik: ${companyMissing.map((m) => m.tr).join(', ')}`, en: `Missing: ${companyMissing.map((m) => m.en).join(', ')}` } : undefined)] : []),
    item('smtp', smtpOk, 'SMTP yapılandırılmış (sipariş e-postaları)', 'SMTP configured (order e-mails)',
      input.smtpSource ? { tr: `Kaynak: ${SOURCE[input.smtpSource].tr}`, en: `Source: ${SOURCE[input.smtpSource].en}` } : undefined),
    {
      id: 'checkout', level: CHECKOUT_READY ? 'ok' : 'info',
      label: { tr: 'Ödeme (checkout) sayfası', en: 'Checkout page' },
      detail: CHECKOUT_READY ? undefined : { tr: 'Henüz yok: "Satın al" düğmesi etkin değil, "Teklif İste" geçerli.', en: 'Not available yet: the "Buy" button stays disabled, "Request a quote" applies.' },
    },
  ]
  // "ready" = everything that gates the surface (legal joined with P7; checkout comes with P5 and does not block).
  const gating = ['capability', 'provider-env', 'provider-enabled', 'vat', 'buy-editions', 'legal', 'company']
  return { items, environment, ready: items.filter((i) => gating.includes(i.id)).every((i) => i.level === 'ok') }
}
