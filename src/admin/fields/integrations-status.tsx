import type { UIFieldServerComponent } from 'payload'

import { isAdminUser } from '@/access/roles'
import { resolvePaymentsConfig, resolveSmtpConfig, envDefinesSmtp } from '@/lib/integrations/runtime'
import { readIntegrationsDoc } from '@/lib/integrations/vault'
import { readSecretsKey } from '@/lib/secrets/crypto'
import { serverUrl } from '@/lib/server-url'

/*
 * Read-only server facts at the top of "Integration settings": the values that deliberately stay on the server
 * (domain, PAYMENTS_ENABLED, PAYMENTS_STRIPE_ENABLED, the encryption key) and where each credential comes from
 * (server / panel / none). Never a secret value. Admin panel sessions only.
 */

type Lang = 'tr' | 'en'
const SOURCE: Record<'env' | 'panel' | 'none', Record<Lang, string>> = {
  env: { tr: 'sunucu ayarı (panel değeri yok sayılır)', en: 'server setting (panel value ignored)' },
  panel: { tr: 'panel', en: 'panel' },
  none: { tr: 'yok', en: 'none' },
}

export const IntegrationsStatus: UIFieldServerComponent = async ({ payload, i18n, req }) => {
  const user = req?.user as (typeof req.user & { _strategy?: string }) | null | undefined
  if (!isAdminUser(user) || user?._strategy === 'api-key') return null
  const lang: Lang = i18n?.language === 'en' ? 'en' : 'tr'
  const key = readSecretsKey()
  let doc: Record<string, unknown> | null = null
  try {
    doc = await readIntegrationsDoc(payload)
  } catch {
    doc = null
  }
  const payments = resolvePaymentsConfig(process.env, doc, key)
  const smtp = resolveSmtpConfig(process.env, doc, key)
  const smtpSource = smtp?.source ?? (envDefinesSmtp() ? 'env' : 'none')
  const yes = lang === 'en' ? 'yes' : 'evet'
  const no = lang === 'en' ? 'no' : 'hayır'
  const envLabel = (env?: string) => (env === 'live' ? (lang === 'en' ? 'LIVE' : 'CANLI') : env ? (lang === 'en' ? 'TEST' : 'TEST') : '')
  const rows: [string, string][] = [
    [lang === 'en' ? 'Site address (NEXT_PUBLIC_SERVER_URL, build time)' : 'Site adresi (NEXT_PUBLIC_SERVER_URL, derleme zamanı)', serverUrl()],
    [lang === 'en' ? 'Payments lock (PAYMENTS_ENABLED)' : 'Ödeme kilidi (PAYMENTS_ENABLED)', process.env.PAYMENTS_ENABLED === 'true' ? (lang === 'en' ? 'open' : 'açık') : (lang === 'en' ? 'closed' : 'kapalı')],
    ['PAYMENTS_STRIPE_ENABLED', process.env.PAYMENTS_STRIPE_ENABLED === 'true' ? yes : no],
    [lang === 'en' ? 'Encryption key (SOFTMARKET_SECRETS_KEY)' : 'Şifreleme anahtarı (SOFTMARKET_SECRETS_KEY)', key ? `${yes} · id ${key.kid}` : no],
    ['iyzico', `${SOURCE[payments.sources.iyzico][lang]}${payments.iyzico ? ` · ${envLabel(payments.iyzico.env)}` : ''}`],
    ['Stripe', `${SOURCE[payments.sources.stripe][lang]}${payments.stripe ? ` · ${envLabel(payments.stripe.env)}` : ''}`],
    ['SMTP', `${SOURCE[smtpSource][lang]}${smtp ? ` · ${smtp.host}:${smtp.port}` : ''}`],
  ]
  const issues = payments.issues.filter((i) => i.startsWith('panel:'))
  return (
    <div style={{ marginBottom: 'var(--base, 20px)', padding: 16, border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }} data-integrations-status="">
      <strong>{lang === 'en' ? 'Server settings (read-only)' : 'Sunucu ayarları (salt okunur)'}</strong>
      <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '4px 12px', margin: '8px 0 0' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt style={{ opacity: 0.75 }}>{label}</dt>
            <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{value}</dd>
          </div>
        ))}
      </dl>
      {issues.length ? (
        <p style={{ margin: '8px 0 0', color: 'var(--theme-error-500)' }}>
          {lang === 'en' ? 'Missing/unreadable panel values: ' : 'Eksik/okunamayan panel değerleri: '}{issues.map((i) => i.replace(/^panel:/, '')).join(', ')}
        </p>
      ) : null}
      {!key ? (
        <p style={{ margin: '8px 0 0', fontSize: 13 }}>
          {lang === 'en'
            ? 'Without SOFTMARKET_SECRETS_KEY no secret can be saved here. Generate one with `openssl rand -base64 32` and back it up: if the key is lost, stored secrets cannot be read.'
            : 'SOFTMARKET_SECRETS_KEY olmadan burada gizli değer kaydedilemez. `openssl rand -base64 32` ile üretin ve yedekleyin: anahtar kaybolursa kayıtlı sırlar okunamaz.'}
        </p>
      ) : null}
      <p style={{ margin: '8px 0 0', fontSize: 12, opacity: 0.7 }}>
        {lang === 'en' ? 'These values change only on the server (environment file + restart/rebuild).' : 'Bu değerler yalnız sunucuda değişir (ortam dosyası + yeniden başlatma/derleme).'}
      </p>
    </div>
  )
}
