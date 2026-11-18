import { licensingKeysResponse } from '@/lib/licensing/public-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(): Promise<Response> {
  return licensingKeysResponse(async () => {
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
    return getPayload({ config })
  })
}
