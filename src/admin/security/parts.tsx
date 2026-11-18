import React from 'react'

import { SECURITY_CENTER_LABELS as L, type SecurityLabel } from '@/lib/security-center-labels'
import {
  SECURITY_BLOCK_KINDS,
  SECURITY_EVENT_SOURCES,
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
  SECURITY_TRIAGE_STATES,
} from '@/lib/licensing/constants'

import { BlockLift, EventActions } from './actions-ui'
import { formatInstant } from './format'
import type { ActivationRow, BlockRow, EventRow, LicenseRef, Paginated, Ref, SuspendedLicenseRow, TransitionRow } from './loaders'
import { BLOCK_STATES, RANGES, securityHref, type SecurityQuery, type Tab } from './query'

/*
 * L6a presentational pieces of the security center. Server components (no hooks): filters are a plain GET form, paging
 * and tabs are links, details use <details>. L6b adds an "Actions" column only when `env.canAct` (admin panel session,
 * decided by the view); the action widgets are client components that POST to the guarded admin endpoints. Text from the database is only ever rendered as
 * React text nodes (escaped); links are built from numeric ids and fixed collection slugs.
 */
export type Lang = 'tr' | 'en'
export type ViewEnv = { lang: Lang; base: string; adminRoute: string; canAct?: boolean }

export const tr = (lang: Lang, label: SecurityLabel): string => label[lang]
const pick = (lang: Lang, map: Record<string, SecurityLabel>, key: string | null | undefined): string => (key ? (map[key]?.[lang] ?? key) : '')

export const severityLabel = (lang: Lang, key: string) => pick(lang, L.severities, key)

export function Badge({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`sc-badge sc-badge--${kind}`}>{children}</span>
}

const Time = ({ value, lang }: { value: string | null; lang: Lang }) => {
  const formatted = formatInstant(value, lang)
  return formatted ? <time dateTime={value!}>{formatted}</time> : <span className="sc-muted">—</span>
}

const Mono = ({ children }: { children: React.ReactNode }) => <code className="sc-mono">{children}</code>

function LicenseCell({ license, lang }: { license: LicenseRef | null; lang: Lang }) {
  if (!license) return <span className="sc-muted">—</span>
  return (
    <div className="sc-stack">
      <a href={license.href}><Mono>{license.publicId || `#${license.id}`}</Mono></a>
      {license.product ? <span className="sc-muted">{license.product.title}</span> : null}
      {license.status ? <span className="sc-muted">{pick(lang, L.licenseStatuses, license.status)}</span> : null}
    </div>
  )
}

function Table({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="sc-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="sc-table">
        <caption className="sc-sr">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

const Head = ({ lang, cols }: { lang: Lang; cols: SecurityLabel[] }) => (
  <thead>
    <tr>{cols.map((c) => <th key={c.en} scope="col">{c[lang]}</th>)}</tr>
  </thead>
)

const Empty = ({ children }: { children: React.ReactNode }) => <p className="sc-empty">{children}</p>

function RecordLinks({ env, items }: { env: ViewEnv; items: { label: SecurityLabel; ref: Ref | null }[] }) {
  const present = items.filter((i) => i.ref)
  if (!present.length) return <span className="sc-muted">—</span>
  return (
    <ul className="sc-links">
      {present.map((i) => <li key={i.label.en}><a href={i.ref!.href}>{i.label[env.lang]}</a></li>)}
    </ul>
  )
}

export function EventsTable({ rows, env, caption }: { rows: EventRow[]; env: ViewEnv; caption: SecurityLabel }) {
  const { lang } = env
  if (!rows.length) return <Empty>{tr(lang, L.empty.events)}</Empty>
  return (
    <Table caption={tr(lang, caption)}>
      <Head lang={lang} cols={[L.columns.severity, L.columns.type, L.columns.count, L.columns.status, L.columns.lastSeen, L.columns.license, L.columns.ip, L.columns.action, L.columns.links, ...(env.canAct ? [L.actions.column] : [])]} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><Badge kind={row.severity}>{pick(lang, L.severities, row.severity)}</Badge></td>
            <td>
              <div className="sc-stack">
                <span>{pick(lang, L.eventTypes, row.type)}</span>
                <span className="sc-muted sc-mono">{row.type}</span>
                <span className="sc-muted">{pick(lang, L.sources, row.source)}{row.ruleKey ? ` · ${row.ruleKey}` : ''}</span>
                {row.detail.entries.length ? (
                  <details className="sc-detail">
                    <summary>{tr(lang, L.detail.show)}</summary>
                    <dl>
                      {row.detail.entries.map((e, idx) => (
                        <React.Fragment key={`${idx}-${e.key}`}>
                          <dt>{e.key}</dt>
                          <dd>{e.redacted ? tr(lang, L.detail.redacted) : e.value}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                    {row.detail.truncated ? <p className="sc-muted">{tr(lang, L.detail.truncatedNote)}</p> : null}
                  </details>
                ) : null}
              </div>
            </td>
            <td className="sc-num">{row.count}</td>
            <td><Badge kind={`triage-${row.triage}`}>{pick(lang, L.triage, row.triage)}</Badge></td>
            <td><Time value={row.lastSeenAt} lang={lang} /></td>
            <td><LicenseCell license={row.license} lang={lang} /></td>
            <td>
              <div className="sc-stack">
                {row.ipPrefix ? <Mono>{row.ipPrefix}</Mono> : <span className="sc-muted">—</span>}
                {row.ipHash ? <span className="sc-muted sc-mono" title={tr(lang, L.columns.ipHash)}>{row.ipHash}</span> : null}
                {row.country ? <span className="sc-muted">{row.country}</span> : null}
              </div>
            </td>
            <td>{row.actionTaken && row.actionTaken !== 'none' ? pick(lang, L.actionsTaken, row.actionTaken) : <span className="sc-muted">{tr(lang, L.none)}</span>}</td>
            <td>
              <RecordLinks
                env={env}
                items={[
                  { label: L.links.openDocument, ref: { id: row.id, href: row.href } },
                  { label: L.columns.activation, ref: row.activation },
                  { label: L.columns.customer, ref: row.customer },
                  { label: L.columns.order, ref: row.order },
                ]}
              />
            </td>
            {env.canAct ? (
              <td>
                <EventActions
                  lang={lang}
                  id={row.id}
                  triage={row.triage}
                  canRestore={row.source === 'rule' && row.actionTaken === 'suspended' && row.license?.status === 'suspended'}
                  hasIpPrefix={Boolean(row.ipPrefix)}
                  hasActivation={row.activation !== null}
                  hasLicense={row.license !== null}
                />
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function BlocksTable({ rows, env }: { rows: BlockRow[]; env: ViewEnv }) {
  const { lang } = env
  if (!rows.length) return <Empty>{tr(lang, L.empty.blocks)}</Empty>
  return (
    <Table caption={tr(lang, L.tableCaption.blocks)}>
      <Head lang={lang} cols={[L.columns.status, L.columns.kind, L.columns.value, L.columns.scope, L.columns.source, L.columns.reason, L.columns.created, L.columns.expires, L.columns.links, ...(env.canAct ? [L.actions.column] : [])]} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><Badge kind={`block-${row.state}`}>{pick(lang, L.blockBadge, row.state)}</Badge></td>
            <td>{pick(lang, L.blockKinds, row.kind)}</td>
            <td><Mono>{row.value}</Mono></td>
            <td>{pick(lang, L.blockScopes, row.scope)}</td>
            <td>{pick(lang, L.blockSources, row.source)}</td>
            <td>
              <div className="sc-stack">
                <span>{row.reason || <span className="sc-muted">—</span>}</span>
                {row.liftReason ? <span className="sc-muted">{row.liftReason}</span> : null}
              </div>
            </td>
            <td><Time value={row.createdAt} lang={lang} /></td>
            <td>
              {row.expiresAt ? <Time value={row.expiresAt} lang={lang} /> : <span className="sc-muted">{tr(lang, L.forever)}</span>}
              {row.liftedAt ? <div className="sc-muted"><Time value={row.liftedAt} lang={lang} /></div> : null}
            </td>
            <td>
              <RecordLinks env={env} items={[{ label: L.links.openDocument, ref: { id: row.id, href: row.href } }, { label: L.columns.event, ref: row.event }]} />
            </td>
            {env.canAct ? <td>{row.state === 'active' ? <BlockLift lang={lang} id={row.id} /> : <span className="sc-muted">—</span>}</td> : null}
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function TransitionsTable({ rows, env, caption = L.tableCaption.transitions }: { rows: TransitionRow[]; env: ViewEnv; caption?: SecurityLabel }) {
  const { lang } = env
  if (!rows.length) return <Empty>{tr(lang, L.empty.transitions)}</Empty>
  return (
    <Table caption={tr(lang, caption)}>
      <Head lang={lang} cols={[L.columns.at, L.columns.license, L.columns.transition, L.columns.reason, L.columns.source, L.columns.note, L.columns.links]} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><Time value={row.at} lang={lang} /></td>
            <td><LicenseCell license={row.license} lang={lang} /></td>
            <td>
              <span className="sc-transition">
                <Badge kind={`license-${row.from}`}>{pick(lang, L.licenseStatuses, row.from)}</Badge>
                <span aria-hidden="true">→</span>
                <span className="sc-sr">{tr(lang, L.transitionTo)}</span>
                <Badge kind={`license-${row.to}`}>{pick(lang, L.licenseStatuses, row.to)}</Badge>
              </span>
            </td>
            <td>{row.reason ? pick(lang, L.statusReasons, row.reason) : <span className="sc-muted">—</span>}</td>
            <td>{pick(lang, L.transitionSources, row.source)}{row.ruleKey ? <span className="sc-muted"> · {row.ruleKey}</span> : null}</td>
            <td>{row.note || <span className="sc-muted">—</span>}</td>
            <td>
              <RecordLinks
                env={env}
                items={[
                  { label: L.links.openDocument, ref: { id: row.id, href: row.href } },
                  { label: L.columns.event, ref: row.event },
                  { label: L.columns.order, ref: row.order },
                  { label: L.columns.actor, ref: row.actor },
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function SuspendedTable({ rows, env }: { rows: SuspendedLicenseRow[]; env: ViewEnv }) {
  const { lang } = env
  if (!rows.length) return <Empty>{tr(lang, L.empty.suspended)}</Empty>
  return (
    <Table caption={tr(lang, L.tableCaption.suspended)}>
      <Head lang={lang} cols={[L.columns.license, L.columns.product, L.columns.reason, L.columns.source, L.columns.changed]} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><a href={row.href}><Mono>{row.publicId || `#${row.id}`}</Mono></a></td>
            <td>{row.product?.title || <span className="sc-muted">—</span>}</td>
            <td>{row.statusReason ? pick(lang, L.statusReasons, row.statusReason) : <span className="sc-muted">—</span>}</td>
            <td>{row.statusSource ? pick(lang, L.transitionSources, row.statusSource) : <span className="sc-muted">—</span>}</td>
            <td><Time value={row.statusChangedAt} lang={lang} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function ActivationsTable({ rows, env }: { rows: ActivationRow[]; env: ViewEnv }) {
  const { lang } = env
  if (!rows.length) return <Empty>{tr(lang, L.empty.activations)}</Empty>
  return (
    <Table caption={tr(lang, L.tableCaption.activations)}>
      <Head lang={lang} cols={[L.columns.activated, L.columns.status, L.columns.license, L.columns.device, L.columns.platform, L.columns.version, L.columns.ip, L.columns.lastSeen]} />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td><a href={row.href}><Time value={row.activatedAt} lang={lang} /></a></td>
            <td><Badge kind={`activation-${row.status}`}>{pick(lang, L.activationStatuses, row.status)}</Badge></td>
            <td><LicenseCell license={row.license} lang={lang} /></td>
            <td>{row.deviceLabel || <span className="sc-muted">—</span>}</td>
            <td>{row.platform ? pick(lang, L.platforms, row.platform) : <span className="sc-muted">—</span>}</td>
            <td>{row.appVersion || <span className="sc-muted">—</span>}</td>
            <td>{row.lastIpPrefix ? <Mono>{row.lastIpPrefix}</Mono> : <span className="sc-muted">—</span>}</td>
            <td><Time value={row.lastSeenAt} lang={lang} /></td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function Pager({ result, q, env, tab }: { result: Paginated<unknown>; q: SecurityQuery; env: ViewEnv; tab: Tab }) {
  const { lang } = env
  if (result.totalPages <= 1) return result.totalDocs ? <p className="sc-pager-total">{result.totalDocs} {tr(lang, L.paging.total)}</p> : null
  const href = (page: number) => securityHref(env.base, { ...q, tab, page })
  return (
    <nav className="sc-pager" aria-label={tr(lang, L.paging.label)}>
      {result.page > 1 ? <a href={href(result.page - 1)} rel="prev">{tr(lang, L.paging.previous)}</a> : <span aria-disabled="true">{tr(lang, L.paging.previous)}</span>}
      <span aria-current="page">{tr(lang, L.paging.page)} {result.page} / {result.totalPages} · {result.totalDocs} {tr(lang, L.paging.total)}</span>
      {result.page < result.totalPages ? <a href={href(result.page + 1)} rel="next">{tr(lang, L.paging.next)}</a> : <span aria-disabled="true">{tr(lang, L.paging.next)}</span>}
    </nav>
  )
}

function Select({ name, label, value, options, lang, allLabel }: { name: string; label: SecurityLabel; value: string | null; options: { value: string; label: string }[]; lang: Lang; allLabel?: string }) {
  const id = `sc-f-${name}`
  return (
    <div className="sc-field">
      <label htmlFor={id}>{tr(lang, label)}</label>
      <select id={id} name={name} defaultValue={value ?? ''}>
        {allLabel !== undefined ? <option value="">{allLabel}</option> : null}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function Filters({ tab, q, env, products }: { tab: Exclude<Tab, 'overview'>; q: SecurityQuery; env: ViewEnv; products: { id: number; title: string }[] }) {
  const { lang } = env
  const all = tr(lang, L.filters.all)
  const range = <Select name="range" label={L.filters.range} value={q.range} lang={lang} options={RANGES.map((r) => ({ value: r, label: tr(lang, L.ranges[r]) }))} />
  const license = (
    <div className="sc-field">
      <label htmlFor="sc-f-license">{tr(lang, L.filters.license)}</label>
      <input id="sc-f-license" name="license" type="text" inputMode="text" autoComplete="off" spellCheck={false} maxLength={24} defaultValue={q.license ?? ''} aria-describedby="sc-f-license-hint" aria-invalid={q.licenseInvalid || undefined} />
      <span id="sc-f-license-hint" className={q.licenseInvalid ? 'sc-hint sc-hint--error' : 'sc-hint'}>{q.licenseInvalid ? tr(lang, L.filters.invalidLicense) : tr(lang, L.filters.licenseHint)}</span>
    </div>
  )
  const product = <Select name="product" label={L.filters.product} value={q.product === null ? null : String(q.product)} lang={lang} allLabel={all} options={products.map((p) => ({ value: String(p.id), label: p.title }))} />
  return (
    <form className="sc-filters" method="get" action={env.base}>
      <fieldset>
        <legend>{tr(lang, L.filters.legend)}</legend>
        <input type="hidden" name="tab" value={tab} />
        <div className="sc-filter-grid">
          {tab === 'events' ? (
            <>
              <fieldset className="sc-checks">
                <legend>{tr(lang, L.filters.severity)}</legend>
                {SECURITY_SEVERITIES.map((s) => (
                  <label key={s}><input type="checkbox" name="severity" value={s} defaultChecked={q.severity.includes(s)} /> {pick(lang, L.severities, s)}</label>
                ))}
              </fieldset>
              <Select name="type" label={L.filters.type} value={q.type} lang={lang} allLabel={all} options={SECURITY_EVENT_TYPES.map((t) => ({ value: t, label: pick(lang, L.eventTypes, t) }))} />
              <Select name="triage" label={L.filters.triage} value={q.triage} lang={lang} options={[{ value: 'all', label: all }, ...SECURITY_TRIAGE_STATES.map((s) => ({ value: s, label: pick(lang, L.triage, s) }))]} />
              {range}
              <Select name="source" label={L.filters.source} value={q.source} lang={lang} allLabel={all} options={SECURITY_EVENT_SOURCES.map((s) => ({ value: s, label: pick(lang, L.sources, s) }))} />
              {license}
              {product}
            </>
          ) : null}
          {tab === 'blocks' ? (
            <>
              <Select name="blockState" label={L.filters.blockState} value={q.blockState} lang={lang} options={BLOCK_STATES.map((s) => ({ value: s, label: tr(lang, L.blockStates[s]) }))} />
              <Select name="blockKind" label={L.filters.blockKind} value={q.blockKind} lang={lang} allLabel={all} options={SECURITY_BLOCK_KINDS.map((k) => ({ value: k, label: pick(lang, L.blockKinds, k) }))} />
            </>
          ) : null}
          {tab === 'status-log' ? (
            <>
              {range}
              {license}
              {product}
            </>
          ) : null}
        </div>
        <div className="sc-filter-actions">
          <button type="submit" className="btn btn--style-primary btn--size-medium">{tr(lang, L.filters.apply)}</button>
          <a href={securityHref(env.base, { tab })} className="sc-reset">{tr(lang, L.filters.reset)}</a>
        </div>
      </fieldset>
    </form>
  )
}
