import { PaymentError } from '../errors'
import type { FetchLike, HeaderLike, ProviderId } from '../types'

/** Webhook bodies above this size are rejected before any parsing (plan §4.2). */
export const MAX_WEBHOOK_BYTES = 256 * 1024
export const DEFAULT_TIMEOUT_MS = 15_000

export function readHeader(headers: HeaderLike, name: string): string | undefined {
  if (typeof (headers as Headers).get === 'function') return (headers as Headers).get(name) ?? undefined
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers as Record<string, string | string[] | undefined>)) {
    if (key.toLowerCase() !== lower) continue
    return Array.isArray(value) ? value[0] : value
  }
  return undefined
}

export function isTooLarge(rawBody: string): boolean {
  return Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES
}

/**
 * Sends a request and parses a JSON object response. Errors are mapped to PaymentError codes;
 * neither the request (which carries auth headers) nor the response body is placed in the error.
 */
export async function requestJson(
  fetchImpl: FetchLike,
  provider: ProviderId,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  opts: { timeoutMs?: number; acceptErrorBody?: boolean } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  let status: number
  let text: string
  let ok: boolean
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal, redirect: 'error' })
    status = res.status
    ok = res.ok
    text = await res.text()
  } catch {
    throw new PaymentError('network_error', { provider })
  } finally {
    clearTimeout(timer)
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new PaymentError(ok ? 'bad_response' : 'http_error', { provider, httpStatus: status })
  }
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new PaymentError('bad_response', { provider, httpStatus: status })
  }
  if (!ok && (!opts.acceptErrorBody || (json as Record<string, unknown>).status !== 'failure')) throw new PaymentError('http_error', { provider, httpStatus: status })
  return { status, json: json as Record<string, unknown> }
}

/** Provider error codes are copied only if they look like short codes (no free text, no PII). */
export function safeCode(value: unknown, fallback: string): string {
  const text = typeof value === 'number' ? String(value) : value
  return typeof text === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(text) ? text : fallback
}

export function str(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}
