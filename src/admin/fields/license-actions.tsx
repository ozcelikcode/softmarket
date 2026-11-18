import type { PayloadRequest, UIFieldServerComponent } from 'payload'
import React from 'react'

import { hasPanelAdminSession } from '@/access'
import { DeviceActions, LicenseActionButtons } from '@/admin/security/actions-ui'
import { formatInstant } from '@/admin/security/format'
import { revokeConfirmation, suspensionKind } from '@/lib/licensing/admin/rules'
import { SECURITY_CENTER_LABELS as L, type SecurityLabel } from '@/lib/security-center-labels'

/*
 * L6b license document sidebar "Lisans işlemleri" (plan §7, the P6 order actions pattern; a `ui` field: no column).
 * Rendered only for an admin's panel session (editors, customers, API keys see nothing; the endpoints enforce the same
 * rule). Reads the SAVED license, its devices and its last 10 status rows through the Local API with the requesting
 * admin and `overrideAccess: false` (the security collections stay authoritative), with `select` so device keys,
 * fingerprint hashes, IP hashes, counters and the license key are never loaded. The client widgets get ids, states and
 * the expected status/timestamp (optimistic concurrency) only.
 */

type Lang = 'tr' | 'en'
const pick = (lang: Lang, map: Record<string, SecurityLabel>, key: string | null | undefined) => (key ? (map[key]?.[lang] ?? key) : '—')

export const LicenseActions: UIFieldServerComponent = async ({ req, id }) => {
  if (!req || !hasPanelAdminSession(req as PayloadRequest) || typeof id !== 'number') return null
  const lang: Lang = req.i18n?.language === 'en' ? 'en' : 'tr'
  const { payload, user } = req
  const read = { req, user, overrideAccess: false, depth: 0 } as const
  let license: { status?: string | null; statusChangedAt?: string | null; statusReason?: string | null; statusSource?: string | null; publicId?: string | null }
  let history: { id: number; from: string; to: string; source: string; reason?: string | null; ruleKey?: string | null; at: string }[]
  let devices: { id: number; publicId: string; status: string; deviceLabel?: string | null; platform?: string | null; lastSeenAt?: string | null; lastIpPrefix?: string | null }[]
  try {
    const [doc, log, acts] = await Promise.all([
      payload.findByID({ ...read, collection: 'licenses', id, select: { status: true, statusChangedAt: true, statusReason: true, statusSource: true, publicId: true } }),
      payload.find({ ...read, collection: 'license-status-log', where: { license: { equals: id } }, sort: ['-at', '-id'], limit: 10, pagination: false,
        select: { from: true, to: true, source: true, reason: true, ruleKey: true, at: true } }),
      payload.find({ ...read, collection: 'license-activations', where: { license: { equals: id } }, sort: '-activatedAt', limit: 25, pagination: false,
        select: { publicId: true, status: true, deviceLabel: true, platform: true, lastSeenAt: true, lastIpPrefix: true } }),
    ])
    license = doc as typeof license
    history = log.docs as unknown as typeof history
    devices = acts.docs as unknown as typeof devices
  } catch {
    payload.logger.error('license-actions: read failed')
    return null
  }
  const status = license.status ?? 'active'
  const last = history[0] ?? null
  const suspension = suspensionKind(status, last ? { to: last.to, source: last.source, reason: last.reason ?? null, rule_key: last.ruleKey ?? null } : null)
  const A = L.actions

  return (
    <section className="sc sc-panel" aria-labelledby="sc-license-panel" data-license-actions="">
      <h3 id="sc-license-panel" className="sc-panel__title">{A.panel.title[lang]}</h3>
      <dl className="sc-panel__facts">
        <dt>{A.panel.status[lang]}</dt>
        <dd><span className={`sc-badge sc-badge--license-${status}`}>{pick(lang, L.licenseStatuses, status)}</span></dd>
        <dt>{A.panel.reason[lang]}</dt>
        <dd>{pick(lang, L.statusReasons, license.statusReason)}</dd>
        <dt>{A.panel.source[lang]}</dt>
        <dd>{pick(lang, L.transitionSources, license.statusSource)}</dd>
        <dt>{A.panel.changed[lang]}</dt>
        <dd>{formatInstant(license.statusChangedAt ?? null, lang) || '—'}</dd>
      </dl>
      {status === 'revoked' ? <p className="sc-muted">{A.panel.revokedNote[lang]}</p> : null}
      <LicenseActionButtons lang={lang} id={id} status={status} changedAt={license.statusChangedAt ?? null} suspension={suspension} confirmHint={revokeConfirmation(license.publicId)} />

      <h4 className="sc-panel__sub">{A.panel.devices[lang]}</h4>
      {devices.length ? (
        <ul className="sc-panel__list">
          {devices.map((d) => (
            <li key={d.id} data-device={d.publicId}>
              <div className="sc-stack">
                <span><span className={`sc-badge sc-badge--activation-${d.status}`}>{pick(lang, L.activationStatuses, d.status)}</span> {d.deviceLabel || <code className="sc-mono">{d.publicId.slice(-6)}</code>}</span>
                <span className="sc-muted">
                  {[d.platform ? pick(lang, L.platforms, d.platform) : null, d.lastIpPrefix, formatInstant(d.lastSeenAt ?? null, lang)].filter(Boolean).join(' · ')}
                </span>
              </div>
              {d.status === 'active' ? <DeviceActions lang={lang} id={d.id} /> : null}
            </li>
          ))}
        </ul>
      ) : <p className="sc-muted">{A.panel.noDevices[lang]}</p>}

      <h4 className="sc-panel__sub">{A.panel.history[lang]}</h4>
      {history.length ? (
        <ol className="sc-panel__list">
          {history.map((row) => (
            <li key={row.id}>
              <span>{pick(lang, L.licenseStatuses, row.from)} → {pick(lang, L.licenseStatuses, row.to)}</span>
              <span className="sc-muted"> · {pick(lang, L.statusReasons, row.reason)} · {pick(lang, L.transitionSources, row.source)} · {formatInstant(row.at, lang)}</span>
            </li>
          ))}
        </ol>
      ) : <p className="sc-muted">{A.panel.noHistory[lang]}</p>}
    </section>
  )
}
