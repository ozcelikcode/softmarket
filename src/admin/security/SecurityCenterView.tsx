import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { redirect } from 'next/navigation'
import React from 'react'

import { SECURITY_CENTER_LABELS as L } from '@/lib/security-center-labels'

import { collectionHref } from './format'
import { SECURITY_CENTER_PATH, decideSecurityCenterAccess } from './guard'
import {
  loadBlocks,
  loadEvents,
  loadOverview,
  loadProductOptions,
  loadStatusLog,
  type Overview,
  type ReadContext,
} from './loaders'
import {
  ActivationsTable,
  BlocksTable,
  EventsTable,
  Filters,
  Pager,
  SuspendedTable,
  TransitionsTable,
  tr,
  severityLabel,
  type Lang,
  type ViewEnv,
} from './parts'
import { parseSecurityQuery, securityHref, type RawSearchParams, type SecurityQuery, type Tab } from './query'
import { SECURITY_SEVERITIES } from '@/lib/licensing/constants'

/*
 * L6a security center (plan §7): read-only admin custom view at /admin/guvenlik.
 * Boundary: `decideSecurityCenterAccess` runs HERE, on the server, before anything is loaded (editor -> /admin,
 * anonymous -> login). All data comes from the Local API with the requesting admin user and `overrideAccess: false`.
 * No client JavaScript of our own. A custom view registered under a new key is rendered by Payload WITHOUT a template,
 * so the view wraps itself in `DefaultTemplate` (nav, header) exactly as Payload's root view does for built-in views.
 */

const TAB_ORDER: { tab: Tab; label: keyof typeof L.tabs }[] = [
  { tab: 'overview', label: 'overview' },
  { tab: 'events', label: 'events' },
  { tab: 'blocks', label: 'blocks' },
  { tab: 'status-log', label: 'statusLog' },
]

function Tabs({ q, env }: { q: SecurityQuery; env: ViewEnv }) {
  return (
    <nav className="sc-tabs" aria-label={tr(env.lang, L.tabsLabel)}>
      <ul>
        {TAB_ORDER.map(({ tab, label }) => (
          <li key={tab}>
            <a href={securityHref(env.base, { tab })} aria-current={q.tab === tab ? 'page' : undefined}>{tr(env.lang, L.tabs[label])}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function Counter({ label, value, hint, href, tone, lang }: { label: string; value: number | null; hint?: string; href?: string; tone?: 'alert' | 'warn'; lang: Lang }) {
  const body = (
    <>
      <dt>{label}</dt>
      <dd className="sc-counter__value">
        {value === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sc-sr">{tr(lang, L.counters.unavailable)}</span>
          </>
        ) : value}
      </dd>
      {hint ? <dd className="sc-counter__hint">{hint}</dd> : null}
    </>
  )
  return (
    <div className={`sc-counter${tone && value ? ` sc-counter--${tone}` : ''}`}>
      {href ? <a className="sc-counter__link" href={href}>{body}</a> : body}
    </div>
  )
}

function OverviewTab({ data, env }: { data: Overview; env: ViewEnv }) {
  const { lang, base, adminRoute } = env
  const s = data.summary
  const tableLink = (href: string, label: string) => <a className="sc-section__more" href={href}>{label} →</a>
  return (
    <>
      <dl className="sc-counters">
        <Counter lang={lang} tone="alert" label={tr(lang, L.counters.openHigh)} value={s.openHigh} hint={tr(lang, L.counters.openHighHint)} href={securityHref(base, { tab: 'events', severity: ['high', 'critical'] })} />
        <Counter lang={lang} label={tr(lang, L.counters.openTotal)} value={s.openTotal} href={securityHref(base, { tab: 'events' })} />
        <Counter lang={lang} label={tr(lang, L.counters.last24h)} value={s.last24h} href={securityHref(base, { tab: 'events', triage: 'all', range: '24h' })} />
        <Counter lang={lang} tone="warn" label={tr(lang, L.counters.activeBlocks)} value={s.activeBlocks} hint={tr(lang, L.counters.activeBlocksHint)} href={securityHref(base, { tab: 'blocks' })} />
        <Counter lang={lang} tone="warn" label={tr(lang, L.counters.suspended)} value={s.suspended} href={`${collectionHref(adminRoute, 'licenses')}?where[status][equals]=suspended`} />
        <Counter lang={lang} label={tr(lang, L.counters.activations24h)} value={s.activations24h} href={collectionHref(adminRoute, 'license-activations')} />
        <Counter lang={lang} label={tr(lang, L.counters.activationsActive)} value={s.activationsActive} href={`${collectionHref(adminRoute, 'license-activations')}?where[status][equals]=active`} />
      </dl>

      <section className="sc-section" aria-labelledby="sc-sev">
        <h2 id="sc-sev">{tr(lang, L.sections.severity)}</h2>
        <ul className="sc-severity">
          {SECURITY_SEVERITIES.map((sev) => (
            <li key={sev}>
              <a href={securityHref(base, { tab: 'events', severity: [sev] })} className={`sc-badge sc-badge--${sev}`}>
                {severityLabel(lang, sev)}
                <span className="sc-severity__n">{s.openBySeverity[sev] ?? '—'}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="sc-section" aria-labelledby="sc-high">
        <h2 id="sc-high">{tr(lang, L.sections.recentHigh)}</h2>
        {data.recentHigh === null ? null : data.recentHigh.length ? <EventsTable rows={data.recentHigh} env={env} caption={L.tableCaption.recentHigh} /> : <p className="sc-empty">{tr(lang, L.empty.recentHigh)}</p>}
        {tableLink(securityHref(base, { tab: 'events', severity: ['high', 'critical'] }), tr(lang, L.links.viewAll))}
      </section>

      <section className="sc-section" aria-labelledby="sc-susp">
        <h2 id="sc-susp">{tr(lang, L.sections.suspendedList)}</h2>
        {data.suspended === null ? null : <SuspendedTable rows={data.suspended} env={env} />}
      </section>

      <section className="sc-section" aria-labelledby="sc-trans">
        <h2 id="sc-trans">{tr(lang, L.sections.recentTransitions)}</h2>
        {data.transitions === null ? null : <TransitionsTable rows={data.transitions} env={env} />}
        {tableLink(securityHref(base, { tab: 'status-log' }), tr(lang, L.links.viewAll))}
      </section>

      <section className="sc-section" aria-labelledby="sc-act">
        <h2 id="sc-act">{tr(lang, L.sections.recentActivations)}</h2>
        {data.activations === null ? null : <ActivationsTable rows={data.activations} env={env} />}
      </section>

      <section className="sc-section" aria-labelledby="sc-links">
        <h2 id="sc-links">{tr(lang, L.sections.shortcuts)}</h2>
        <ul className="sc-links sc-links--inline">
          <li><a href={collectionHref(adminRoute, 'security-events')}>{tr(lang, L.links.events)}</a></li>
          <li><a href={collectionHref(adminRoute, 'security-blocks')}>{tr(lang, L.links.blocks)}</a></li>
          <li><a href={collectionHref(adminRoute, 'security-audit')}>{tr(lang, L.links.audit)}</a></li>
          <li><a href={collectionHref(adminRoute, 'license-status-log')}>{tr(lang, L.links.statusLog)}</a></li>
          <li><a href={collectionHref(adminRoute, 'license-activations')}>{tr(lang, L.links.activations)}</a></li>
          <li><a href={collectionHref(adminRoute, 'licenses')}>{tr(lang, L.links.licenses)}</a></li>
          <li><a href={`${adminRoute}/globals/licensing-settings`}>{tr(lang, L.links.settings)}</a></li>
        </ul>
      </section>
    </>
  )
}

export async function SecurityCenterView({ initPageResult, params, searchParams, user }: AdminViewServerProps) {
  const req = initPageResult?.req
  const payload = req?.payload
  const rawAdminRoute = payload?.config?.routes?.admin ?? '/admin'
  const adminRoute = rawAdminRoute === '/' ? '' : rawAdminRoute.replace(/\/+$/, '')
  const decision = decideSecurityCenterAccess(req, rawAdminRoute)
  if (!decision.ok) redirect(decision.redirectTo)

  const lang: Lang = req.i18n?.language === 'en' ? 'en' : 'tr'
  const env: ViewEnv = { lang, adminRoute, base: `${adminRoute}${SECURITY_CENTER_PATH}` }
  const q = parseSecurityQuery(searchParams as RawSearchParams)
  const ctx: ReadContext = { payload, user: req.user!, headers: req.headers, lang, adminRoute, now: new Date() }

  let body: React.ReactNode
  let failed = false
  try {
    if (q.tab === 'events') {
      const [result, products] = await Promise.all([loadEvents(ctx, q), loadProductOptions(ctx).catch(() => [])])
      body = (
        <>
          <Filters tab="events" q={q} env={env} products={products} />
          <EventsTable rows={result.rows} env={env} caption={L.tableCaption.events} />
          <Pager result={result} q={q} env={env} tab="events" />
        </>
      )
    } else if (q.tab === 'blocks') {
      const result = await loadBlocks(ctx, q)
      body = (
        <>
          <Filters tab="blocks" q={q} env={env} products={[]} />
          <BlocksTable rows={result.rows} env={env} />
          <Pager result={result} q={q} env={env} tab="blocks" />
        </>
      )
    } else if (q.tab === 'status-log') {
      const [result, products] = await Promise.all([loadStatusLog(ctx, q), loadProductOptions(ctx).catch(() => [])])
      body = (
        <>
          <Filters tab="status-log" q={q} env={env} products={products} />
          <TransitionsTable rows={result.rows} env={env} />
          <Pager result={result} q={q} env={env} tab="status-log" />
        </>
      )
    } else {
      const data = await loadOverview(ctx, q)
      failed = data.partial
      body = <OverviewTab data={data} env={env} />
    }
  } catch (error) {
    payload.logger.error(`security-center: ${q.tab} failed (${error instanceof Error ? error.name : 'error'})`)
    failed = true
    body = null
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user ?? req.user ?? undefined}
      visibleEntities={{ collections: initPageResult.visibleEntities?.collections, globals: initPageResult.visibleEntities?.globals }}
    >
      <Gutter>
        <div className="sc">
          <header className="sc-header">
            <h1>{tr(lang, L.title)}</h1>
            <p>{tr(lang, L.intro)}</p>
          </header>
          <Tabs q={q} env={env} />
          {failed ? <p className="sc-notice" role="status">{tr(lang, L.loadError)}</p> : null}
          <div className="sc-body">{body}</div>
          <p className="sc-footnote">{tr(lang, L.readOnlyNote)}</p>
        </div>
      </Gutter>
    </DefaultTemplate>
  )
}

export default SecurityCenterView
