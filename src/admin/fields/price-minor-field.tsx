'use client'

import { FieldError, FieldLabel, useField, useTranslation } from '@payloadcms/ui'
import type { NumberFieldClientComponent } from 'payload'
import { useEffect, useState } from 'react'

import { formatMinorForInput, parsePriceInput } from '@/lib/payments/price-input'
import type { Currency } from '@/lib/payments/types'

/*
 * Admin price entry (P3 user decision): a normal decimal box ("1.250,00" TR / "1,250.00" EN; comma or dot tolerated)
 * for the integer minor-unit fields `tryMinor|usdMinor|eurMinor`. The stored value stays the integer; parsing is
 * pure string/integer logic (`parsePriceInput`), never a float. Unparseable text stores -1, which the field
 * validator rejects, so a garbled amount can never be saved silently. Lives in the Payload import map only.
 */

const CURRENCY_BY_FIELD: Record<string, Currency> = { tryMinor: 'TRY', usdMinor: 'USD', eurMinor: 'EUR' }
const INVALID = -1

export const PriceMinorField: NumberFieldClientComponent = ({ field, path, readOnly }) => {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en' : 'tr'
  const currency = CURRENCY_BY_FIELD[path.split('.').pop() ?? ''] ?? 'TRY'
  const { value, setValue, showError } = useField<number | null>({ path })
  const stored = typeof value === 'number' && value >= 0 ? value : null
  const [text, setText] = useState(() => (stored === null ? '' : formatMinorForInput(stored, currency, locale)))
  const [invalid, setInvalid] = useState(false)

  // External changes (document load, reset, autosave echo) win over a stale text box.
  useEffect(() => {
    // Preserve local invalid keystrokes; an external valid/null value must clear that state.
    if (value === INVALID) return
    const parsed = text.trim() ? parsePriceInput(text, currency) : null
    if (invalid || parsed !== stored) setText(stored === null ? '' : formatMinorForInput(stored, currency, locale))
    setInvalid(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency, locale])

  const commit = (next: string) => {
    setText(next)
    if (!next.trim()) {
      setInvalid(false)
      setValue(null)
      return
    }
    const minor = parsePriceInput(next, currency)
    setInvalid(minor === null)
    setValue(minor === null ? INVALID : minor)
  }

  const hint = locale === 'en' ? 'Enter the amount, e.g. 1,250.00' : 'Tutarı girin, örn. 1.250,00'
  return (
    <div className={`field-type number${showError || invalid ? ' error' : ''}`} style={{ marginBottom: 'var(--base, 20px)' }}>
      <FieldLabel htmlFor={`field-${path.replace(/\./g, '__')}`} label={field.label} path={path} required={field.required} />
      <div style={{ position: 'relative' }}>
        <input
          id={`field-${path.replace(/\./g, '__')}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          readOnly={readOnly}
          placeholder={locale === 'en' ? '1,250.00' : '1.250,00'}
          aria-invalid={invalid || undefined}
          aria-describedby={`${path}-hint`}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            const minor = text.trim() ? parsePriceInput(text, currency) : null
            if (minor !== null) setText(formatMinorForInput(minor, currency, locale))
          }}
          style={{ width: '100%', paddingRight: '3.5rem' }}
        />
        <span aria-hidden style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, fontSize: 12 }}>{currency}</span>
      </div>
      <p id={`${path}-hint`} style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.7 }}>{invalid ? (locale === 'en' ? 'Not a valid amount.' : 'Geçerli bir tutar değil.') : hint}</p>
      <FieldError path={path} showError={showError} />
    </div>
  )
}
