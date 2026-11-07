import { enablePreview } from '@/lib/preview-route'

// Staff-only draft mode for the admin Live Preview iframe (F8). Never cached.
export const dynamic = 'force-dynamic'

export const GET = (request: Request) => enablePreview(request)
