/*
 * V5 visual editor (admin): bring a block's form row into view and open its collapsible field groups
 * (Görünüm, Hareket, Hareket › Gelişmiş). Groups mount lazily (a nested group only exists after its parent
 * opens), so instead of fixed delays a MutationObserver reacts to every mount until a deadline. Each toggle is
 * clicked at most once: a group the editor closes again stays closed. Focus is never moved (the canvas keeps
 * keyboard focus).
 *
 * Payload DOM contract (3.93, checked by the visual editor e2e): block row `#<path>-row-<index>`, collapsible field
 * `.collapsible-field__collapsible.collapsible--collapsed` with `.collapsible__toggle-wrap .collapsible__toggle`.
 */
export const COLLAPSED_GROUP = '.collapsible-field__collapsible.collapsible--collapsed'
const TOGGLE = ':scope > .collapsible__toggle-wrap .collapsible__toggle'

export function revealRow(path: string, index: number, { timeout = 4000, root = document.body } = {}): () => void {
  const id = `${path.split('.').join('-')}-row-${index}`
  const clicked = new WeakSet<Element>()
  let scrolled = false
  let done = false
  const tick = () => {
    if (done) return
    const row = document.getElementById(id)
    if (!row) return
    if (!scrolled) {
      scrolled = true
      row.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    row.querySelectorAll<HTMLElement>(COLLAPSED_GROUP).forEach((group) => {
      if (clicked.has(group)) return
      // Only this block's own groups (not those inside its array rows or nested blocks).
      if (group.closest('[id*="-row-"]') !== row) return
      const toggle = group.querySelector<HTMLElement>(TOGGLE)
      if (!toggle) return
      clicked.add(group)
      toggle.click()
    })
  }
  const observer = new MutationObserver(tick)
  observer.observe(root, { childList: true, subtree: true })
  const raf = requestAnimationFrame(tick)
  const stop = () => {
    done = true
    observer.disconnect()
    cancelAnimationFrame(raf)
    window.clearTimeout(timer)
  }
  const timer = window.setTimeout(stop, timeout)
  return stop
}
