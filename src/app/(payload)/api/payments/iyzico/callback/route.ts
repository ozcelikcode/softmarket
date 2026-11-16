import { paymentsRoute } from '@/lib/payments/route'

// iyzico Checkout Form return (cross-site browser POST with `token`): server-side retrieve, then 303 to the order page.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = paymentsRoute('iyzico-callback')
