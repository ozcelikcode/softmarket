import type { PayloadRequest, UIFieldServerComponent } from 'payload'
import React from 'react'

import { hasPanelAdminSession } from '@/access'
import { RotateSigningKeyButton } from '@/admin/security/actions-ui'
import { SECURITY_CENTER_LABELS as L } from '@/lib/security-center-labels'

/*
 * L6b "Generate / rotate key" in the licensing settings "Signing keys" tab (plan §1.2, §4.8). Admin panel session only;
 * the button posts a typed confirmation to POST /api/globals/licensing-settings/rotate-signing-key. Only the active
 * key's public `kid` is shown (from the already public metadata); nothing from the vault is read here.
 */
export const SigningKeyRotate: UIFieldServerComponent = ({ req, data }) => {
  if (!req || !hasPanelAdminSession(req as PayloadRequest)) return null
  const lang = req.i18n?.language === 'en' ? 'en' : 'tr'
  const rows = ((data as { signingKeys?: { kid?: string; retiredAt?: string | null; revokedAt?: string | null }[] } | undefined)?.signingKeys ?? [])
  const active = rows.find((row) => row.kid && !row.retiredAt && !row.revokedAt)
  return (
    <section className="sc sc-panel" aria-labelledby="sc-signing" data-signing-key-actions="">
      <h3 id="sc-signing" className="sc-panel__title">{L.actions.signing.title[lang]}</h3>
      <p>
        {active ? <>{L.actions.signing.active[lang]}: <code className="sc-mono">{active.kid}</code></> : L.actions.signing.none[lang]}
      </p>
      <RotateSigningKeyButton lang={lang} />
    </section>
  )
}
