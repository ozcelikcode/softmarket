import type { CommerceState } from './commerce-state'
import { resolveEditionOffer, type EditionOffer, type PriceOffer } from './mode'

/**
 * Single source for what a product page shows per edition and in the hero (plan §7.2). Pure.
 * Invariants (locked by tests): "Teklif İste" is always available; in quote mode every action is `quote`;
 * a `buy` action exists only for a valid priced offer while the payments surface is open.
 */
export type EditionAction =
  | { kind: 'quote' }
  | { kind: 'buy'; prices: PriceOffer[]; taxMode: 'inclusive' | 'exclusive'; /** false until P5: the button must not link anywhere. */ checkout: boolean }

export const QUOTE_ACTION: EditionAction = { kind: 'quote' }

export function resolveEditionAction(editionOffer: EditionOffer | undefined, state: CommerceState, taxMode: unknown): EditionAction {
  if (!state.open || editionOffer?.kind !== 'buy' || !editionOffer.prices.length) return QUOTE_ACTION
  return { kind: 'buy', prices: editionOffer.prices, taxMode: taxMode === 'exclusive' ? 'exclusive' : 'inclusive', checkout: state.checkoutOpen }
}

export function resolveProductActions(input: { editions: unknown[]; state: CommerceState }): {
  editions: EditionAction[]
  /** Hero primary action; `buy` only when a buy action can actually reach checkout. */
  heroPrimary: 'quote' | 'buy'
} {
  const { state } = input
  const editions = input.editions.map((edition) => {
    const offer = resolveEditionOffer({
      gate: state.gate, edition, vatSettings: state.vatSettings, availableProviders: state.availableProviders,
      stripeEnabled: state.stripeEnabled, stripeCurrencies: state.stripeCurrencies,
    })
    const pricing = edition && typeof edition === 'object' ? (edition as Record<string, unknown>).pricing : undefined
    return resolveEditionAction(offer, state, pricing && typeof pricing === 'object' ? (pricing as Record<string, unknown>).taxMode : undefined)
  })
  const heroPrimary = state.checkoutOpen && editions.some((a) => a.kind === 'buy') ? 'buy' : 'quote'
  return { editions, heroPrimary }
}
