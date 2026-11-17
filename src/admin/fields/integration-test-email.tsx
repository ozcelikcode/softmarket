'use client'

import { useTranslation } from '@payloadcms/ui'
import { useState } from 'react'

/*
 * "Send test e-mail" (integrations › SMTP). POSTs to the admin-only endpoint, which sends ONLY to the signed-in
 * admin's own address with the SAVED settings (rate limited). Shows short result codes; no transport details.
 */

const RESULT: Record<string, { tr: string; en: string }> = {
  sent: { tr: 'Test e-postası kendi adresinize gönderildi.', en: 'Test e-mail sent to your own address.' },
  smtp_not_configured: { tr: 'SMTP yapılandırılmamış (kayıtlı ayar yok ya da şifre okunamıyor).', en: 'SMTP is not configured (no saved settings or the password is unreadable).' },
  send_failed: { tr: 'Gönderilemedi. Sunucu, port, TLS, kullanıcı ve şifreyi kontrol edin.', en: 'Could not send. Check host, port, TLS, user and password.' },
  rate_limited: { tr: 'Çok sık deneme: bir dakika bekleyin (saatte en çok 5).', en: 'Too many attempts: wait a minute (at most 5 per hour).' },
  no_recipient: { tr: 'Hesabınızda e-posta adresi yok.', en: 'Your account has no e-mail address.' },
  forbidden: { tr: 'Yetkiniz yok.', en: 'Not allowed.' },
  panel_session_required: { tr: 'Yalnız yönetici panel oturumu.', en: 'Admin panel session only.' },
}

export function IntegrationTestEmail() {
  const { i18n } = useTranslation()
  const lang = i18n?.language === 'en' ? 'en' : 'tr'
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  async function send() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/globals/integrations/test-email', { method: 'POST', credentials: 'same-origin' })
      const data = (await res.json().catch(() => ({}))) as { code?: string }
      const code = typeof data.code === 'string' ? data.code : 'send_failed'
      setMessage({ text: RESULT[code]?.[lang] ?? code, ok: res.ok })
    } catch {
      setMessage({ text: lang === 'en' ? 'Request failed.' : 'İstek başarısız.', ok: false })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ margin: '0 0 var(--base, 20px)' }} data-integration-test-email="">
      <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => void send()}>
        {lang === 'en' ? 'Send test e-mail (to me)' : 'Test e-postası gönder (bana)'}
      </button>
      <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.7 }}>
        {lang === 'en' ? 'Uses the SAVED settings; save changes first.' : 'KAYITLI ayarları kullanır; önce değişiklikleri kaydedin.'}
      </p>
      {message ? <p role="status" style={{ margin: '6px 0 0', color: message.ok ? 'var(--theme-success-500)' : 'var(--theme-error-500)' }}>{message.text}</p> : null}
    </div>
  )
}
