import { paymentsRoute } from '@/lib/payments/route'

// Stripe notifications (Stripe-Signature, 300 s tolerance). Adapter is off by default: 404 unless PAYMENTS_STRIPE_ENABLED.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = paymentsRoute('stripe-webhook')
