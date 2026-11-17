'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/*
 * Client half of the P6 order actions (src/admin/fields/order-actions.tsx). Imports nothing from the payment code:
 * it only confirms and POSTs to the admin-only endpoint (same-origin cookie session), then shows the short result
 * code as a message and refreshes the document. The server decides everything (amount = order total).
 */

type Action = 'refund' | 'cancel' | 'resend-notifications'
type Lang = 'tr' | 'en'

const T = {
  title: { tr: 'Sipariş işlemleri', en: 'Order actions' },
  refund: { tr: 'İade et', en: 'Refund' },
  cancel: { tr: 'İptal et', en: 'Cancel order' },
  'resend-notifications': { tr: 'Bildirimi yeniden gönder', en: 'Resend notifications' },
  confirm: { tr: 'Onayla', en: 'Confirm' },
  back: { tr: 'Vazgeç', en: 'Back' },
  busy: { tr: 'İşleniyor…', en: 'Working…' },
  none: { tr: 'Bu durumdaki sipariş için işlem yok.', en: 'No action for an order in this state.' },
} as const

const QUESTION: Record<Action, (total: string) => Record<Lang, string>> = {
  refund: (total) => ({
    tr: `Tutarın tamamı (${total}) ödeme sağlayıcısında iade edilecek ve siparişin lisansları iptal edilecek. Kısmi iade yok. Bu işlem geri alınamaz.`,
    en: `The full amount (${total}) will be refunded at the payment provider and the order's licenses revoked. No partial refunds. This cannot be undone.`,
  }),
  cancel: () => ({
    tr: 'Ödenmemiş sipariş iptal edilecek. Sağlayıcı ödemeyi almışsa iptal yapılmaz, sipariş güncellenir.',
    en: 'The unpaid order will be cancelled. If the provider already has the payment, nothing is cancelled and the order is updated.',
  }),
  'resend-notifications': () => ({
    tr: 'Gönderilemeyen bildirimlerin deneme sayacı sıfırlanacak ve hemen yeniden gönderilecek.',
    en: 'The attempt counter of undelivered notifications is reset and they are sent again now.',
  }),
}

const RESULT: Record<string, Record<Lang, string>> = {
  refunded: { tr: 'İade edildi; lisanslar iptal edildi, müşteriye e-posta kuyruğa alındı.', en: 'Refunded; licenses revoked, customer e-mail queued.' },
  already_refunded: { tr: 'Sağlayıcıda zaten iade edilmiş; sipariş güncellendi. Yeni iade yapılmadı.', en: 'Already refunded at the provider; order updated. No new refund was made.' },
  refund_pending: { tr: 'Sağlayıcı iadeyi işliyor; onaylanınca sipariş otomatik güncellenir.', en: 'The provider is processing the refund; the order updates automatically once confirmed.' },
  refund_uncertain: { tr: 'Sağlayıcıdan net yanıt alınamadı. İade TEKRAR DENENMEDİ; sipariş incelemeye alındı. Mutabakat sağlayıcıyı yeniden sorgular.', en: 'No clear answer from the provider. The refund was NOT retried; the order is flagged for review. Reconcile re-reads the provider.' },
  refund_in_progress: { tr: 'Bu sipariş için önceki iade denemesi henüz sonuçlanmadı; yeni iade yapılmadı.', en: 'An earlier refund attempt for this order is not settled yet; no new refund was made.' },
  refund_rejected: { tr: 'Sağlayıcı iadeyi reddetti; para iade edilmedi. Sağlayıcı panelini kontrol edin.', en: 'The provider rejected the refund; nothing was refunded. Check the provider dashboard.' },
  partially_refunded: { tr: 'Sağlayıcıda kısmi iade var; sipariş incelemeye alındı.', en: 'Partially refunded at the provider; order flagged for review.' },
  not_refundable: { tr: 'Bu durumdaki sipariş iade edilemez.', en: 'This order cannot be refunded in its current state.' },
  provider_unavailable: { tr: 'Ödeme sağlayıcısına ulaşılamadı; hiçbir işlem yapılmadı.', en: 'The payment provider could not be reached; nothing was changed.' },
  provider_not_paid: { tr: 'Sağlayıcıda tahsil edilmiş ödeme yok; iade yapılmadı.', en: 'No captured payment at the provider; no refund made.' },
  no_payment_id: { tr: 'Siparişte sağlayıcı ödeme numarası yok.', en: 'The order has no provider payment ID.' },
  cancelled: { tr: 'Sipariş iptal edildi.', en: 'Order cancelled.' },
  already_cancelled: { tr: 'Sipariş zaten iptal.', en: 'Order already cancelled.' },
  not_cancellable: { tr: 'Sipariş iptal edilemez (ödenmiş ya da durumu değişmiş).', en: 'The order cannot be cancelled (paid or changed).' },
  already_paid: { tr: 'Sağlayıcı ödemeyi almış; iptal edilmedi, sipariş güncellendi.', en: 'The provider has the payment; not cancelled, order updated.' },
  provider_review: { tr: 'Ödeme sağlayıcıda inceleniyor; iptal edilmedi.', en: 'The payment is under provider review; not cancelled.' },
  resent: { tr: 'Bildirimler gönderildi.', en: 'Notifications sent.' },
  nothing_to_resend: { tr: 'Gönderilecek bildirim yok (ya da SMTP yapılandırılmamış).', en: 'Nothing to send (or SMTP is not configured).' },
  notify_busy: { tr: 'Gönderim şu an sürüyor; biraz sonra tekrar deneyin.', en: 'A delivery is running; try again shortly.' },
  notify_failed: { tr: 'Gönderim başarısız; hata kodu kaydedildi.', en: 'Delivery failed; the error code was recorded.' },
  forbidden: { tr: 'Yetkiniz yok.', en: 'Not allowed.' },
  panel_session_required: { tr: 'Yalnız yönetici panel oturumu.', en: 'Admin panel session only.' },
}

export function OrderActionsClient(props: {
  orderId: string
  lang: Lang
  total: string
  status: string
  canRefund: boolean
  canCancel: boolean
  canResend: boolean
}) {
  const { lang } = props
  const router = useRouter()
  const [pending, setPending] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (pending) confirmRef.current?.focus() }, [pending])

  const actions: Action[] = [
    ...(props.canRefund ? (['refund'] as const) : []),
    ...(props.canCancel ? (['cancel'] as const) : []),
    ...(props.canResend ? (['resend-notifications'] as const) : []),
  ]

  async function run(action: Action) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(props.orderId)}/${action}`, {
        method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' },
      })
      const body = (await res.json().catch(() => ({}))) as { code?: string; detail?: string }
      const text = (body.code && RESULT[body.code]?.[lang]) ?? `${lang === 'en' ? 'Error' : 'Hata'} (${res.status}${body.code ? ` ${body.code}` : ''})`
      setMessage({ text: body.detail ? `${text} [${body.detail}]` : text, ok: res.ok })
      router.refresh()
    } catch {
      setMessage({ text: RESULT.provider_unavailable![lang], ok: false })
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div data-order-actions="" style={{ marginBottom: 'var(--base, 20px)', padding: 12, border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }}>
      <strong style={{ display: 'block', marginBottom: 8 }}>{T.title[lang]}</strong>
      {actions.length === 0 ? <p style={{ margin: 0, opacity: 0.7 }}>{T.none[lang]}</p> : null}
      {pending ? (
        <div role="alertdialog" aria-modal="false" aria-labelledby="order-action-q" style={{ display: 'grid', gap: 8 }}>
          <p id="order-action-q" style={{ margin: 0 }}>{QUESTION[pending](props.total)[lang]}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button ref={confirmRef} type="button" className="btn btn--style-primary btn--size-small" disabled={busy} onClick={() => run(pending)} data-order-action-confirm={pending}>
              {busy ? T.busy[lang] : `${T[pending][lang]} — ${T.confirm[lang]}`}
            </button>
            <button type="button" className="btn btn--style-secondary btn--size-small" disabled={busy} onClick={() => setPending(null)}>{T.back[lang]}</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {actions.map((action) => (
            <button key={action} type="button" className={`btn btn--size-small ${action === 'refund' ? 'btn--style-primary' : 'btn--style-secondary'}`} onClick={() => setPending(action)} data-order-action={action}>
              {T[action][lang]}
            </button>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite" style={{ margin: message ? '8px 0 0' : 0, color: message && !message.ok ? 'var(--theme-error-500)' : undefined }}>{message?.text ?? ''}</p>
    </div>
  )
}
