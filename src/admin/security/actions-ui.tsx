'use client'

import React from 'react'

import { SECURITY_CENTER_LABELS as L } from '@/lib/security-center-labels'

import { ActionForm, ActionGroup, type ActionField, type Lang } from './action-client'

/*
 * L6b action widgets, rendered by server components with plain serialisable props (ids, states, the admin language).
 * Every widget posts to an endpoint under /api that re-checks the admin panel session; nothing here grants access.
 */

const A = L.actions

const durationOptions = (lang: Lang): ActionField => ({
  name: 'duration', type: 'select', label: A.duration, initial: '24',
  options: [
    { value: '1', label: A.durations.h1[lang] },
    { value: '24', label: A.durations.h24[lang] },
    { value: '168', label: A.durations.h168[lang] },
    { value: 'forever', label: A.durations.forever[lang] },
  ],
})
const durationValue = (value: unknown) => (value === 'forever' ? null : Number(value ?? 24))
const selfConfirm: ActionField = { name: 'confirmSelf', type: 'checkbox', label: A.selfConfirm, revealOnCode: 'self_block_confirmation_required' }

export function EventActions(props: {
  lang: Lang
  id: number
  triage: string
  canRestore: boolean
  hasIpPrefix: boolean
  hasActivation: boolean
  hasLicense: boolean
}) {
  const { lang, id, triage } = props
  const base = `/api/security-events/${id}`
  const open = triage === 'open' || triage === 'acknowledged'
  const blockKinds = [
    ...(props.hasIpPrefix ? [{ value: 'ip_prefix', label: A.blockIp[lang] }] : []),
    ...(props.hasActivation ? [{ value: 'activation', label: A.blockActivation[lang] }, { value: 'fingerprint', label: A.blockFingerprint[lang] }] : []),
    ...(props.hasLicense ? [{ value: 'license', label: A.blockLicense[lang] }] : []),
  ]
  return (
    <ActionGroup>
      {triage === 'open' ? (
        <ActionForm lang={lang} url={`${base}/acknowledge`} label={A.acknowledge} question={A.questions.acknowledge} testId={`event-${id}-acknowledge`}
          body={() => ({ expectedTriage: triage })} />
      ) : null}
      {open ? (
        <>
          <ActionForm lang={lang} url={`${base}/resolve`} label={A.resolve} question={A.questions.resolve} testId={`event-${id}-resolve`}
            body={() => ({ expectedTriage: triage })} />
          <ActionForm lang={lang} url={`${base}/false-positive`} label={A.falsePositive} question={A.questions.falsePositive} testId={`event-${id}-false-positive`}
            body={() => ({ expectedTriage: triage })} />
          {props.canRestore ? (
            <ActionForm lang={lang} url={`${base}/false-positive`} label={A.falsePositiveRestore} question={A.questions.falsePositiveRestore} tone="primary"
              testId={`event-${id}-restore`} body={() => ({ expectedTriage: triage, restore: true })} />
          ) : null}
        </>
      ) : null}
      {blockKinds.length ? (
        <ActionForm lang={lang} url={`${base}/block`} label={A.block} question={A.questions.block} testId={`event-${id}-block`}
          fields={[{ name: 'kind', type: 'select', label: A.kind, options: blockKinds }, durationOptions(lang), selfConfirm]}
          body={(v) => ({ kind: v.kind, durationHours: durationValue(v.duration), confirmSelf: v.confirmSelf === true })} />
      ) : null}
    </ActionGroup>
  )
}

export function BlockLift({ lang, id }: { lang: Lang; id: number }) {
  return <ActionForm lang={lang} url={`/api/security-blocks/${id}/lift`} label={A.lift} question={A.questions.lift} testId={`block-${id}-lift`} />
}

export function AddBlock({ lang }: { lang: Lang }) {
  return (
    <section className="sc-section sc-add-block" aria-label={A.addBlock[lang]}>
      <p className="sc-muted">{A.addBlockIntro[lang]}</p>
      <ActionForm lang={lang} url="/api/security-blocks/add" label={A.addBlock} question={A.questions.block} tone="primary" testId="block-add"
        fields={[
          { name: 'value', type: 'text', label: A.value, placeholder: '203.0.113.0/24', maxLength: 64, required: true },
          { name: 'kind', type: 'select', label: A.kind, options: [{ value: 'ip_prefix', label: L.blockKinds.ip_prefix[lang] }, { value: 'cidr', label: L.blockKinds.cidr[lang] }] },
          durationOptions(lang),
          selfConfirm,
        ]}
        body={(v) => ({ kind: v.kind, value: String(v.value ?? '').trim(), durationHours: durationValue(v.duration), confirmSelf: v.confirmSelf === true })} />
    </section>
  )
}

export function LicenseActionButtons(props: {
  lang: Lang
  id: number
  status: string
  changedAt: string | null
  /** 'rule' | 'manual' = restorable, 'other' = reactivate, null = not suspended. */
  suspension: 'rule' | 'manual' | 'other' | null
  confirmHint: string
}) {
  const { lang, id, status } = props
  const base = `/api/licenses/${id}`
  const expected = { status, changedAt: props.changedAt }
  const body = () => ({ expected })
  return (
    <ActionGroup>
      {status === 'active' ? <ActionForm lang={lang} url={`${base}/suspend`} label={A.suspend} question={A.questions.suspend} tone="primary" testId="license-suspend" body={body} /> : null}
      {props.suspension === 'rule' || props.suspension === 'manual'
        ? <ActionForm lang={lang} url={`${base}/restore`} label={A.restore} question={A.questions.restore} tone="primary" testId="license-restore" body={body} />
        : null}
      {props.suspension === 'other'
        ? <ActionForm lang={lang} url={`${base}/reactivate`} label={A.reactivate} question={A.questions.reactivate} tone="primary" testId="license-reactivate" body={body} />
        : null}
      {status === 'active' || status === 'suspended' ? (
        <ActionForm lang={lang} url={`${base}/revoke`} label={A.revoke} question={A.questions.revoke} tone="danger" testId="license-revoke" body={body}
          typedConfirm={{ label: A.revokeConfirm, hint: props.confirmHint }} />
      ) : null}
    </ActionGroup>
  )
}

export function DeviceActions({ lang, id }: { lang: Lang; id: number }) {
  const url = `/api/license-activations/${id}/deactivate`
  return (
    <ActionGroup>
      <ActionForm lang={lang} url={url} label={A.releaseDevice} question={A.questions.releaseDevice} testId={`device-${id}-release`} body={() => ({ mode: 'release' })} />
      <ActionForm lang={lang} url={url} label={A.revokeDevice} question={A.questions.revokeDevice} tone="danger" testId={`device-${id}-revoke`} body={() => ({ mode: 'revoke' })} />
    </ActionGroup>
  )
}

export function RotateSigningKeyButton({ lang }: { lang: Lang }) {
  return (
    <ActionForm lang={lang} url="/api/globals/licensing-settings/rotate-signing-key" label={A.rotate} question={A.questions.rotate} tone="danger" testId="signing-rotate"
      typedConfirm={{ label: A.rotateConfirm, hint: A.rotateWord[lang] }} />
  )
}
