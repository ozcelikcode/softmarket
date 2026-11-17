'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/*
 * Client half of a write-only secret (src/admin/fields/integration-secret.tsx). The typed value lives only in this
 * component's local state (NOT in Payload's form state, so it is never autosaved, never part of the document save and
 * never sent back by the server). "Save key" POSTs { id, value } to the admin-only endpoint; the input is cleared
 * immediately, then the page refreshes to show the new status. Imports nothing from server code.
 */

type Lang = 'tr' | 'en'
type Status = { defined: boolean; last4: string | null; updatedAt: string | null; unreadable?: boolean } | null

const T = {
  set: { tr: 'Tanımlı', en: 'Set' },
  unset: { tr: 'Tanımlı değil', en: 'Not set' },
  unreadable: { tr: 'Okunamıyor (şifreleme anahtarı değişmiş ya da SMTP sunucu/kullanıcı değişmiş): yeniden girin', en: 'Unreadable (encryption key changed, or SMTP host/user changed): enter it again' },
  updated: { tr: 'güncellendi', en: 'updated' },
  change: { tr: 'Değiştir', en: 'Change' },
  enter: { tr: 'Gir', en: 'Enter' },
  clear: { tr: 'Temizle', en: 'Clear' },
  save: { tr: 'Anahtarı kaydet', en: 'Save key' },
  cancel: { tr: 'Vazgeç', en: 'Cancel' },
  confirmClear: { tr: 'Kayıtlı değer silinsin mi? Bu işlem geri alınamaz.', en: 'Delete the stored value? This cannot be undone.' },
  envOverride: { tr: 'Sunucu ayarı kullanılıyor (panel değeri yok sayılır).', en: 'Server setting in use (the panel value is ignored).' },
  noKey: { tr: 'Sunucuda SOFTMARKET_SECRETS_KEY tanımlı değil: gizli değer kaydedilemez.', en: 'SOFTMARKET_SECRETS_KEY is not set on the server: secrets cannot be saved.' },
  writeOnly: { tr: 'Değer bir daha gösterilmez; yalnız değiştirilebilir veya temizlenebilir.', en: 'The value is never shown again; it can only be replaced or cleared.' },
  busy: { tr: 'Kaydediliyor…', en: 'Saving…' },
} as const

const RESULT: Record<string, Record<Lang, string>> = {
  ok: { tr: 'Kaydedildi.', en: 'Saved.' },
  empty: { tr: 'Değer boş.', en: 'The value is empty.' },
  too_long: { tr: 'Değer çok uzun.', en: 'The value is too long.' },
  invalid_chars: { tr: 'Geçersiz karakter (boşluk/kontrol karakteri).', en: 'Invalid characters (spaces/control characters).' },
  invalid_format: { tr: 'Biçim bu alana veya seçili ortama uymuyor (ör. test için sk_test_, canlı için sk_live_, webhook için whsec_).', en: 'Format does not match this field or environment (e.g. sk_test_ for test, sk_live_ for live, whsec_ for webhooks).' },
  no_key: { tr: 'Sunucuda şifreleme anahtarı yok; kaydedilmedi.', en: 'No encryption key on the server; not saved.' },
  smtp_host_required: { tr: 'Önce SMTP sunucusunu (ve kullanıcıyı) kaydedin.', en: 'Save the SMTP host (and user) first.' },
  forbidden: { tr: 'Yetkiniz yok.', en: 'Not allowed.' },
  panel_session_required: { tr: 'Yalnız yönetici panel oturumu.', en: 'Admin panel session only.' },
  cross_origin: { tr: 'İstek reddedildi (farklı kaynak).', en: 'Request refused (cross-origin).' },
}

export function IntegrationSecretClient(props: {
  secretId: string
  label: string
  lang: Lang
  status: Status
  envOverride: boolean
  keyConfigured: boolean
}) {
  const { lang, status } = props
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/globals/integrations/secret', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { code?: string }
      const code = typeof data.code === 'string' ? data.code : 'internal'
      setMessage({ text: RESULT[code]?.[lang] ?? code, ok: res.ok })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    } catch {
      setMessage({ text: lang === 'en' ? 'Request failed.' : 'İstek başarısız.', ok: false })
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    const typed = value
    if (!typed.trim() || busy) return
    setValue('')
    void post({ id: props.secretId, value: typed })
  }

  const when = status?.updatedAt ? new Date(status.updatedAt).toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR') : null
  const box = { margin: '0 0 var(--base, 20px)', padding: 12, border: '1px solid var(--theme-elevation-150)', borderRadius: 4 } as const
  return (
    <div style={box} data-integration-secret={props.secretId}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <strong>{props.label}</strong>
        <span style={{ fontSize: 13 }}>
          {status === null ? '—' : status.defined
            ? <>{T.set[lang]}{status.last4 ? <> · <code>…{status.last4}</code></> : null}{when ? <> · {T.updated[lang]} {when}</> : null}</>
            : T.unset[lang]}
        </span>
      </div>
      {status?.unreadable ? <p style={{ margin: '6px 0 0', color: 'var(--theme-error-500)' }}>{T.unreadable[lang]}</p> : null}
      {props.envOverride ? <p style={{ margin: '6px 0 0', fontSize: 13 }}>{T.envOverride[lang]}</p> : null}
      {!props.keyConfigured ? <p style={{ margin: '6px 0 0', color: 'var(--theme-error-500)', fontSize: 13 }}>{T.noKey[lang]}</p> : null}
      {editing ? (
        // Not a <form>: this renders inside Payload's document form (nested forms are invalid and Enter would save it).
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <input
            type="password"
            aria-label={props.label}
            autoComplete="new-password"
            spellCheck={false}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }}
            style={{ flex: '1 1 260px', padding: '6px 8px' }}
          />
          <button type="button" className="btn btn--style-primary btn--size-small" disabled={busy || !value.trim()} onClick={submit}>{busy ? T.busy[lang] : T.save[lang]}</button>
          <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => { setValue(''); setEditing(false) }}>{T.cancel[lang]}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy || !props.keyConfigured} onClick={() => setEditing(true)}>
            {status?.defined ? T.change[lang] : T.enter[lang]}
          </button>
          {status?.defined ? (
            <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy}
              onClick={() => { if (window.confirm(T.confirmClear[lang])) void post({ id: props.secretId, clear: true }) }}>
              {T.clear[lang]}
            </button>
          ) : null}
        </div>
      )}
      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.7 }}>{T.writeOnly[lang]}</p>
      {message ? <p role="status" style={{ margin: '6px 0 0', color: message.ok ? 'var(--theme-success-500)' : 'var(--theme-error-500)' }}>{message.text}</p> : null}
    </div>
  )
}
