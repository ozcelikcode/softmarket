import type { Payload } from 'payload'

import { licensingHmacKey } from '../crypto/hmac'
import { readDownloadAccess } from './download-catalog'
import { downloadRange, fileResponseHeaders, openDownloadFile, streamDownload } from './download-file'
import { downloadGrants } from './download-tokens'
import { apiAvailable, entitlementError } from './entitlement'
import { LICENSING_API_PATH } from './guard'
import { failure, respond, type ErrorCode } from './respond'
import { loadPayload, readConfiguration, type RouteDependencies } from './route'
import { clientNetwork, runtimeFor, trafficRejection } from './runtime'

export function createLicensingDownload({ loadPayload, now: clock = () => new Date() }: RouteDependencies) {
  return async (request: Request, token: string): Promise<Response> => {
    const head = request.method === 'HEAD'
    const unsigned = (response: Response) => {
      response.headers.set('Cache-Control', 'private, no-store')
      response.headers.set('Referrer-Policy', 'no-referrer')
      return head ? new Response(null, { status: response.status, headers: response.headers }) : response
    }
    const deny = (code: ErrorCode, at = clock(), size?: number) => {
      const response = respond(failure(code, at), at)
      if (size !== undefined) {
        response.headers.set('Content-Range', `bytes */${size}`)
        response.headers.set('Accept-Ranges', 'bytes')
      }
      return unsigned(response)
    }
    let payload: Payload | undefined
    let enabled = false
    try {
      const startedAt = clock()
      payload = await loadPayload()
      const { settings, signer, issuer } = await readConfiguration(payload)
      const key = licensingHmacKey('download')
      if (!settings.apiEnabled || !signer || !issuer || !key) return deny('unavailable')
      enabled = true

      const runtime = runtimeFor(payload)
      const network = clientNetwork(request.headers, startedAt)
      const traffic = await trafficRejection(runtime, settings.limits, network, startedAt)
      if (traffic) return unsigned(respond(traffic, startedAt))
      if (new URL(request.url).pathname !== `${LICENSING_API_PATH}/dl/${token}`) return deny('invalid_token')

      const grants = downloadGrants(payload)
      const grant = grants.find(key, token, clock())
      if (!grant) return deny('invalid_token')
      const file = await openDownloadFile(grant.file.filename)
      let streaming = false
      try {
        const db = payload.db.drizzle
        if (!await apiAvailable(db, signer.kid)) return deny('unavailable')
        const access = await readDownloadAccess(db, grant, clock())
        const now = clock()
        if (!grants.admit(grant, now, false)) return deny('invalid_token', now)
        if (!access) return deny('download_unavailable', now)
        const { ip } = network
        const subject = { license: access.license, customer: access.customer, activation: access.activation }
        if (runtime.blocks.matches(now, network, access)) {
          runtime.observations.emit({ type: 'api.blocked_request', now, ip, ...subject })
          return deny('blocked', now)
        }
        const denied = entitlementError(access, access.deviceStatus, now)
        if (denied) return deny(denied === 'invalid_license' ? 'download_unavailable' : denied, now)
        if (!access.fileMatches || file?.etag !== grant.etag) return deny('download_unavailable', now)
        const range = head ? null : downloadRange(request.headers, file)
        if (range === false) return deny('range_not_satisfiable', now, file.size)

        const headers = new Headers(fileResponseHeaders(file, grant.file.filename, grant.file.mime))
        headers.set('Date', now.toUTCString())
        headers.set('Content-Length', String(range ? range.end - range.start + 1 : file.size))
        if (range) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`)
        if (!grants.admit(grant, now, !head)) return deny('invalid_token', now)
        const body = head || file.size === 0 ? null : streamDownload(file, request.signal, range)
        const response = new Response(body, { status: range ? 206 : 200, headers })
        streaming = body !== null
        if (!head) runtime.observations.emit({ type: 'download.started', now, ip, ...subject })
        return response
      } finally {
        if (!streaming) await file?.handle.close()
      }
    } catch {
      payload?.logger.error('licensing: download request failed')
      return deny(enabled ? 'internal' : 'unavailable')
    }
  }
}

export const licensingDownload = createLicensingDownload({ loadPayload })
