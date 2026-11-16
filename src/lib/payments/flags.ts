/**
 * Checkout feature flag. P5 flipped it on: the checkout route (`/hesap/satin-al/[sku]`), portal orders and order
 * e-mails ship. It is NOT what opens payments: `open` (env capability + site mode + provider + VAT + legalReady)
 * must still hold, so a default install stays quote-only and no buy action or checkout page is reachable.
 */
export const CHECKOUT_READY = true
