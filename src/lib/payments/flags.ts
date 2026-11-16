/**
 * P3 feature flag. Checkout does not exist yet (P5): while this is `false`, a "Buy" action can never lead to a
 * checkout URL. Prices are still shown in payments mode, the buy button is disabled, "Teklif İste" stays.
 * P5 flips it once the checkout route, portal orders and e-mails ship (plan §8 P5 acceptance).
 */
export const CHECKOUT_READY = false
