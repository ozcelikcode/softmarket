import type { UIFieldServerComponent } from 'payload'

import { isAdminUser } from '@/access'
import { isLegalDraft } from '@/lib/legal-draft'
import { COMMERCE_LEGAL_SLUGS } from '@/lib/payments/legal'
import { buildReadiness, type LegalPageFact } from '@/lib/payments/readiness'

/*
 * Read-only readiness checklist inside site-settings "Satış ve ödeme" (a `ui` field: no DB column, no schema).
 * Server component: reads the SAVED state with overrideAccess, shows only configured/missing and SANDBOX/LIVE,
 * never a secret value. Visible to admins only.
 */

const MARK = { ok: '✓', missing: '✕', info: 'i' } as const
const COLOR = { ok: 'var(--theme-success-500)', missing: 'var(--theme-error-500)', info: 'var(--theme-elevation-500)' } as const

export const CommerceReadiness: UIFieldServerComponent = async ({ payload, i18n, user }) => {
  if (!isAdminUser(user)) return null
  const lang = i18n?.language === 'en' ? 'en' : 'tr'
  let model: ReturnType<typeof buildReadiness> | null = null
  try {
    const [siteSettings, editions, ...pages] = await Promise.all([
      payload.findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true, select: { commerce: true } }),
      payload.find({ collection: 'editions', depth: 0, limit: 500, pagination: false, overrideAccess: true, select: { saleMode: true, pricing: true } }),
      ...(['tr', 'en'] as const).map((locale) => payload.find({
        collection: 'pages', locale, depth: 0, limit: 20, pagination: false, overrideAccess: true, draft: false,
        where: { and: [{ pageType: { equals: 'legal' } }, { slug: { in: [...COMMERCE_LEGAL_SLUGS[locale]] } }, { _status: { equals: 'published' } }] },
        select: { slug: true, layout: true },
      })),
    ])
    const legalPages: LegalPageFact[] = pages.flatMap((r) => r.docs.map((d) => ({
      slug: String((d as { slug?: unknown }).slug ?? ''), published: true, draft: isLegalDraft((d as { layout?: unknown }).layout),
    })))
    model = buildReadiness({ env: process.env, siteSettings, editions: editions.docs, legalPages })
  } catch {
    model = null
  }
  const title = lang === 'en' ? 'Readiness (saved settings)' : 'Hazırlık durumu (kayıtlı ayarlar)'
  return (
    <div style={{ marginBottom: 'var(--base, 20px)', padding: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }} data-commerce-readiness="">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <strong>{title}</strong>
        {model?.environment ? (
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, color: '#fff', background: model.environment === 'live' ? 'var(--theme-success-500)' : 'var(--theme-warning-500, #b45309)' }}>
            {model.environment === 'mixed' ? (lang === 'en' ? 'MIXED (SANDBOX / LIVE)' : 'KARMA (TEST / CANLI)') : model.environment === 'live' ? (lang === 'en' ? 'LIVE' : 'CANLI') : (lang === 'en' ? 'TEST MODE (SANDBOX)' : 'TEST MODU (SANDBOX)')}
          </span>
        ) : null}
      </div>
      {model ? (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {model.items.map((item) => (
            <li key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span aria-hidden style={{ color: COLOR[item.level], fontWeight: 700, width: 14, textAlign: 'center' }}>{MARK[item.level]}</span>
              <span>
                <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{item.level === 'ok' ? (lang === 'en' ? 'Ready: ' : 'Hazır: ') : item.level === 'missing' ? (lang === 'en' ? 'Missing: ' : 'Eksik: ') : (lang === 'en' ? 'Note: ' : 'Not: ')}</span>
                {item.label[lang]}
                {item.detail ? <span style={{ opacity: 0.65 }}> — {item.detail[lang]}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : <p style={{ margin: 0 }}>{lang === 'en' ? 'Could not read the settings.' : 'Ayarlar okunamadı.'}</p>}
      <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.7 }}>
        {lang === 'en' ? 'Shows the saved values; save changes to refresh. Keys are never displayed.' : 'Kayıtlı değerleri gösterir; yenilemek için değişiklikleri kaydedin. Anahtarlar hiçbir zaman gösterilmez.'}
      </p>
    </div>
  )
}
