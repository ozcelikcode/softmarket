import type { PayloadRequest } from 'payload'

import type { LicensingAdminRoute } from './endpoints'

/** L6b admin action endpoint (src/lib/licensing/admin/endpoints.ts): admin panel session + same origin only. */
export const adminAction = (path: string, route: LicensingAdminRoute) => ({
  path,
  method: 'post' as const,
  handler: async (req: PayloadRequest) => (await import('@/lib/licensing/admin/endpoints')).handleLicensingAdminAction(req, route),
})
