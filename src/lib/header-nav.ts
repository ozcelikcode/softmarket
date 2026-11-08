/**
 * Header interactions on server-rendered markup (no React state, no Radix):
 * - desktop mega menu: `[data-mega-nav]` with `[data-mega-trigger]` buttons (aria-controls -> panel)
 *   and `[data-mega-top]` top-level focus targets (triggers + plain links);
 * - mobile sheet: native modal `<dialog data-sheet>` opened by `[data-sheet-open]`.
 *
 * Mirrors the former Radix NavigationMenu/Dialog behaviour: hover intent (80 ms open, 150 ms close,
 * 300 ms skip-delay), click toggle (a click-close is not reopened by hover until the pointer leaves),
 * Escape closes and returns focus, ArrowLeft/Right/Home/End between top-level items, ArrowDown opens
 * and enters the panel, ArrowUp/Down within the panel, outside pointer/focus closes, link click closes.
 */

export const OPEN_DELAY = 80
export const CLOSE_DELAY = 150
export const SKIP_DELAY = 300

const LINKS = 'a[href], button:not([disabled])'

type Cleanup = () => void

function on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void, cleanups: Cleanup[], opts?: AddEventListenerOptions) {
  el.addEventListener(type, fn as EventListener, opts)
  cleanups.push(() => el.removeEventListener(type, fn as EventListener, opts))
}

export function initMegaNav(nav: HTMLElement): Cleanup {
  const doc = nav.ownerDocument
  const win = doc.defaultView ?? window
  const cleanups: Cleanup[] = []
  const triggers = Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-mega-trigger]'))
  const panelOf = (t: HTMLElement) => doc.getElementById(t.getAttribute('aria-controls') ?? '')
  let current: HTMLButtonElement | null = null
  let openTimer = 0
  let closeTimer = 0
  let closedAt = 0
  let clickClosed: HTMLButtonElement | null = null

  const clearTimers = () => { win.clearTimeout(openTimer); win.clearTimeout(closeTimer) }
  const setState = (t: HTMLButtonElement, open: boolean) => {
    const panel = panelOf(t)
    t.setAttribute('aria-expanded', String(open))
    t.dataset.state = open ? 'open' : 'closed'
    if (panel) { panel.dataset.state = open ? 'open' : 'closed'; panel.hidden = !open }
  }
  const open = (t: HTMLButtonElement) => {
    clearTimers()
    if (current === t) return
    if (current) setState(current, false)
    current = t
    setState(t, true)
  }
  const close = (restoreFocus = false) => {
    clearTimers()
    if (!current) return
    const t = current
    current = null
    closedAt = Date.now()
    setState(t, false)
    if (restoreFocus) t.focus()
  }
  const panelLinks = (t: HTMLElement) => Array.from(panelOf(t)?.querySelectorAll<HTMLElement>(LINKS) ?? [])
  const tops = () => Array.from(nav.querySelectorAll<HTMLElement>('[data-mega-top]'))
  const closeAfterHover = () => {
    if (current && !current.parentElement?.contains(doc.activeElement)) close()
  }

  for (const t of triggers) {
    const panel = panelOf(t)
    on(t, 'click', () => {
      if (current === t) { close(); clickClosed = t } else { clickClosed = null; open(t) }
    }, cleanups)
    on(t, 'pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || clickClosed === t) return
      win.clearTimeout(closeTimer)
      win.clearTimeout(openTimer)
      if (current || Date.now() - closedAt < SKIP_DELAY) open(t)
      else openTimer = win.setTimeout(() => open(t), OPEN_DELAY)
    }, cleanups)
    on(t, 'pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return
      if (clickClosed === t) clickClosed = null
      win.clearTimeout(openTimer)
      if (current) closeTimer = win.setTimeout(closeAfterHover, CLOSE_DELAY)
    }, cleanups)
    if (panel) {
      on(panel, 'pointerenter', (e) => { if (e.pointerType === 'mouse') win.clearTimeout(closeTimer) }, cleanups)
      on(panel, 'pointerleave', (e) => {
        if (e.pointerType === 'mouse' && current === t) closeTimer = win.setTimeout(closeAfterHover, CLOSE_DELAY)
      }, cleanups)
      // Selecting a link closes the menu (Radix NavigationMenu.Link onSelect).
      on(panel, 'click', (e) => { if ((e.target as Element).closest?.('a[href]')) close() }, cleanups)
    }
  }

  on(nav, 'keydown', (e) => {
    const target = e.target as HTMLElement
    const list = tops()
    const topIndex = list.indexOf(target)
    if (e.key === 'Escape') {
      if (current) { e.preventDefault(); close(true) }
      return
    }
    if (topIndex >= 0) {
      const move = e.key === 'ArrowRight' ? topIndex + 1 : e.key === 'ArrowLeft' ? topIndex - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1
      if (move >= 0 && move < list.length) { e.preventDefault(); list[move].focus(); return }
      if (e.key === 'ArrowDown' && triggers.includes(target as HTMLButtonElement)) {
        e.preventDefault()
        open(target as HTMLButtonElement)
        panelLinks(target)[0]?.focus()
      }
      return
    }
    if (current && panelOf(current)?.contains(target) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const links = panelLinks(current)
      const i = links.indexOf(target)
      const next = links[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), links.length - 1)]
      if (next) { e.preventDefault(); next.focus() }
    }
  }, cleanups)

  // Focus moving to another top-level item or out of the nav closes the open panel.
  on(nav, 'focusin', (e) => {
    if (current && !current.parentElement?.contains(e.target as Node)) close()
  }, cleanups)
  on(nav, 'focusout', (e) => {
    const next = e.relatedTarget as Node | null
    if (current && (!next || !nav.contains(next))) close()
  }, cleanups)
  on(doc, 'pointerdown', (e) => {
    if (current && !nav.contains(e.target as Node)) close()
  }, cleanups)
  on(doc, 'keydown', (e) => {
    if (e.key === 'Escape' && current && !nav.contains(e.target as Node)) close()
  }, cleanups)

  return () => { close(); clearTimers(); cleanups.forEach((c) => c()) }
}

/** Mobile drawer on a native modal dialog: Escape and inert background are native; Tab wrapping is done here. */
export function initSheet(root: HTMLElement, desktopQuery = '(min-width: 64rem)'): Cleanup {
  const doc = root.ownerDocument
  const win = doc.defaultView ?? window
  const cleanups: Cleanup[] = []
  const button = root.querySelector<HTMLButtonElement>('[data-sheet-open]')
  const dialog = button ? doc.getElementById(button.getAttribute('aria-controls') ?? '') : null
  if (!button || !(dialog instanceof win.HTMLDialogElement)) return () => {}
  let unlock: (() => void) | undefined

  on(button, 'click', () => {
    if (dialog.open) return
    unlock?.()
    dialog.showModal()
    // iOS Safari can scroll the page behind a modal even with overflow hidden on html.
    const body = doc.body
    const y = win.scrollY
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width }
    Object.assign(body.style, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%' })
    unlock = () => { Object.assign(body.style, previous); win.scrollTo(win.scrollX, y); unlock = undefined }
    button.setAttribute('aria-expanded', 'true')
  }, cleanups)
  on(dialog, 'close', () => {
    if (dialog.open) return // A queued close event can arrive after the dialog was reopened.
    unlock?.()
    button.setAttribute('aria-expanded', 'false')
    if (!doc.activeElement || doc.activeElement === doc.body) button.focus()
  }, cleanups)
  // Chromium may hand Tab focus to the browser UI from a native modal: wrap first/last ourselves.
  const tabbables = () => Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button, summary, input, select, textarea, [tabindex]')).filter((el) => {
    if (el.matches(':disabled') || el.getAttribute('tabindex') === '-1' || el.closest('[hidden], [inert]')) return false
    const details = el.closest('details:not([open])')
    if (details && !(el.tagName === 'SUMMARY' && el.parentElement === details)) return false
    return el.getClientRects().length > 0 && win.getComputedStyle(el).visibility !== 'hidden'
  })
  on(doc, 'keydown', (e) => {
    if (e.key !== 'Tab' || !dialog.open || e.defaultPrevented) return
    const list = tabbables()
    if (!list.length) { e.preventDefault(); return }
    const active = doc.activeElement as HTMLElement | null
    const first = list[0]
    const last = list[list.length - 1]
    if (!active || !dialog.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus() }
    else if (e.shiftKey && (active === first || active === dialog)) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
  }, cleanups)
  on(dialog, 'click', (e) => {
    const target = e.target as Element
    // Backdrop (the dialog box itself), links and explicit close controls dismiss the drawer.
    if (target === dialog || target.closest('a[href], [data-sheet-close]')) dialog.close()
  }, cleanups)
  const mq = win.matchMedia?.(desktopQuery)
  if (mq) {
    const onChange = () => { if (mq.matches && dialog.open) dialog.close() }
    mq.addEventListener('change', onChange)
    cleanups.push(() => mq.removeEventListener('change', onChange))
  }
  return () => { if (dialog.open) dialog.close(); unlock?.(); button.setAttribute('aria-expanded', 'false'); cleanups.forEach((c) => c()) }
}
