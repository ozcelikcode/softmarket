/**
 * Payment errors carry a short code and the provider id only.
 * Messages never include secrets, request bodies, buyer data or raw provider messages,
 * so they are safe to log as-is. No `cause` is attached (it could carry a request/response).
 */
export type PaymentErrorCode =
  | 'not_configured'
  | 'invalid_config'
  | 'invalid_input'
  | 'network_error'
  | 'http_error'
  | 'provider_error'
  | 'bad_response'
  | 'signature_mismatch'

export class PaymentError extends Error {
  readonly code: PaymentErrorCode
  readonly provider?: string
  readonly httpStatus?: number

  constructor(code: PaymentErrorCode, opts: { provider?: string; httpStatus?: number; detail?: string } = {}) {
    const parts = [`payments:${code}`]
    if (opts.provider) parts.push(`provider=${opts.provider}`)
    if (opts.httpStatus) parts.push(`status=${opts.httpStatus}`)
    // `detail` must be a static, non-sensitive string chosen by our code (e.g. a field name).
    if (opts.detail) parts.push(opts.detail)
    super(parts.join(' '))
    this.name = 'PaymentError'
    this.code = code
    this.provider = opts.provider
    this.httpStatus = opts.httpStatus
  }
}
