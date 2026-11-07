import { disablePreview } from '@/lib/preview-route'

// Leaves draft mode (F8). Never cached.
export const dynamic = 'force-dynamic'

export const GET = (request: Request) => disablePreview(request)
