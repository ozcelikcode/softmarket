import { paymentsRoute } from '@/lib/payments/route'

// iyzico notifications (X-IYZ-SIGNATURE-V3). Trigger only: the order state comes from a server-side retrieve.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = paymentsRoute('iyzico-webhook')
