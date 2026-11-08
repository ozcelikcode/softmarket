'use client'

import { FieldError, FieldLabel, useField, useFormFields, useTranslation } from '@payloadcms/ui'
import type { SelectFieldClientComponent } from 'payload'
import { useState, type CSSProperties } from 'react'

import { MOTION_DELAYS, MOTION_DURATION_MS, MOTION_DURATIONS, MOTION_EASINGS, MOTION_PRESETS, type MotionPreset } from '@/fields/block-motion'
import { MOTION_LABELS as M } from '@/lib/admin-i18n'

/*
 * Admin-only "Hareket" preset picker (V1-UI). Lives in the Payload import map; never imported from the
 * (frontend) tree. Each card shows a pure-CSS mini preview that plays with the block's current
 * duration/delay/easing; "Tekrar oynat" restarts every preview. Stored value = the plain select value.
 */

const EASE: Record<string, string> = {
  soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
}

const CSS = `
.smm{margin-bottom:var(--base,20px)}
.smm__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
.smm__replay{font:inherit;font-size:12px;padding:4px 10px;border-radius:4px;border:1px solid var(--theme-elevation-150);background:var(--theme-elevation-50);color:var(--theme-text);cursor:pointer}
.smm__replay:hover{background:var(--theme-elevation-100)}
.smm__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:0;padding:0;border:0}
.smm__card{position:relative;display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:6px;border:1px solid var(--theme-elevation-150);background:var(--theme-elevation-0);cursor:pointer;text-align:left}
.smm__card:hover{border-color:var(--theme-elevation-400)}
.smm__card:focus-within{outline:2px solid var(--theme-success-500);outline-offset:1px}
.smm__card[data-selected]{border-color:var(--theme-success-500);box-shadow:0 0 0 1px var(--theme-success-500)}
.smm__card input{position:absolute;opacity:0;pointer-events:none}
.smm__stage{position:relative;height:52px;border-radius:4px;background:var(--theme-elevation-50);overflow:hidden;display:flex;align-items:center;justify-content:center;gap:4px}
.smm__box{width:34px;height:22px;border-radius:3px;background:var(--theme-elevation-400)}
.smm__name{font-size:13px;font-weight:600;color:var(--theme-text)}
.smm__desc{font-size:11px;line-height:1.35;color:var(--theme-elevation-600)}
.smm__note{font-size:12px;color:var(--theme-elevation-600);margin-top:6px}
@keyframes smm-in{from{opacity:var(--o,0);transform:var(--from,none)}}
@keyframes smm-par{from{transform:translateY(10px)}to{transform:translateY(-10px)}}
@media (prefers-reduced-motion:no-preference){
.smm__stage[data-play] .smm__box{animation:smm-in var(--d) var(--e) var(--w) both}
.smm__stage[data-preset="parallax-soft"][data-play] .smm__box{animation:smm-par 1.6s ease-in-out infinite alternate}
.smm__stage[data-preset="stagger"][data-play] .smm__box:nth-child(2){animation-delay:calc(var(--w) + 100ms)}
.smm__stage[data-preset="stagger"][data-play] .smm__box:nth-child(3){animation-delay:calc(var(--w) + 200ms)}
}
`

const FROM: Partial<Record<MotionPreset, string>> = {
  auto: 'translateY(6px)',
  'slide-up': 'translateY(14px)',
  'slide-down': 'translateY(-14px)',
  'slide-left': 'translateX(18px)',
  'slide-right': 'translateX(-18px)',
  'zoom-in': 'scale(0.8)',
  stagger: 'translateY(10px)',
}

export const MotionPresetCards: SelectFieldClientComponent = (props) => {
  const { path, field, readOnly } = props
  const { i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en' : 'tr'
  const { value, setValue } = useField<string>({ path })
  const base = path.slice(0, path.lastIndexOf('.'))
  const duration = useFormFields(([fields]) => fields[`${base}.duration`]?.value) as string | undefined
  const delay = useFormFields(([fields]) => fields[`${base}.delay`]?.value) as string | undefined
  const easing = useFormFields(([fields]) => fields[`${base}.easing`]?.value) as string | undefined
  const trigger = useFormFields(([fields]) => fields[`${base}.trigger`]?.value) as string | undefined
  const [round, setRound] = useState(0)
  const allowed = ((field.admin?.custom as { presets?: MotionPreset[] } | undefined)?.presets ?? MOTION_PRESETS) as readonly MotionPreset[]
  const current = value || 'auto'
  // Drafts and legacy records may contain unknown or hero-incompatible values. Never look those up
  // as label keys or add them to the allowed choices; leave all radios unselected so they can be repaired.
  const presets = MOTION_PRESETS.filter((preset) => allowed.includes(preset))
  const ms = MOTION_DURATION_MS[MOTION_DURATIONS.find((v) => v === duration) ?? 'base']
  const vars = {
    '--d': `${ms}ms`,
    '--w': `${MOTION_DELAYS.find((v) => v === delay) ?? '0'}ms`,
    '--e': EASE[MOTION_EASINGS.find((v) => v === easing) ?? 'soft'],
  } as CSSProperties
  const name = `smm-${path}`
  const hero = allowed.length < MOTION_PRESETS.length

  return (
    <div className="smm field-type">
      <style>{CSS}</style>
      <div className="smm__head">
        <FieldLabel label={field.label} path={path} as="span" />
        <button type="button" className="smm__replay" onClick={() => setRound((r) => r + 1)}>
          ↻ {M.replay[lang]}
        </button>
      </div>
      <FieldError path={path} />
      <fieldset className="smm__grid" aria-label={M.fields.preset[lang]}>
        {presets.map((preset) => {
          const [title, desc] = M.presets[preset]
          const selected = preset === current
          const boxes = preset === 'stagger' ? 3 : 1
          return (
            <label key={preset} className="smm__card" data-selected={selected ? '' : undefined}>
              <input
                type="radio"
                name={name}
                value={preset}
                checked={selected}
                disabled={readOnly}
                onChange={() => setValue(preset)}
              />
              <span
                key={`${preset}-${round}-${ms}-${delay}-${easing}-${trigger}`}
                className="smm__stage"
                data-preset={preset}
                data-play={preset === 'none' ? undefined : ''}
                style={{ ...vars, '--from': FROM[preset] ?? 'none' } as CSSProperties}
                aria-hidden
              >
                {Array.from({ length: boxes }, (_, i) => <span key={i} className="smm__box" />)}
              </span>
              <span className="smm__name">{title[lang]}</span>
              <span className="smm__desc">{desc[lang]}</span>
            </label>
          )
        })}
      </fieldset>
      <p className="smm__note">{hero ? M.heroNote[lang] : M.lcpNote[lang]}</p>
    </div>
  )
}
