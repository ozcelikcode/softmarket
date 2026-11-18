import { licensingPost } from '@/lib/licensing/api/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = licensingPost('validate')
