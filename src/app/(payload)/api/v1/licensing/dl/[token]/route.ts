import { licensingDownload } from '@/lib/licensing/api/download-route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return licensingDownload(request, (await params).token)
}

export const HEAD = GET
