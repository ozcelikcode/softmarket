import { hmacSha256Hex, safeEqualHex } from './compare'

/**
 * iyzico signatures. Sources (verified 2026-11-08):
 * - Request auth IYZWSv2: https://docs.iyzico.com/en/getting-started/preliminaries/authentication/hmacsha256-auth
 *     signature = hex(HMAC-SHA256(secretKey, randomKey + uriPath + body))
 *     header    = "IYZWSv2 " + base64("apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + signature)
 * - Response signature: https://docs.iyzico.com/en/advanced/response-signature-validation
 *     hex(HMAC-SHA256(secretKey, params.join(':'))), prices with trailing zeros removed.
 * - Webhook X-IYZ-SIGNATURE-V3: https://docs.iyzico.com/en/advanced/webhook
 *     HPP (Checkout Form): hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status))
 *     Direct:              hex(HMAC-SHA256(secretKey, secretKey + iyziEventType + paymentId + paymentConversationId + status))
 */

export function iyzicoRequestSignature(secretKey: string, randomKey: string, uriPath: string, body: string): string {
  return hmacSha256Hex(secretKey, `${randomKey}${uriPath}${body}`)
}

export function iyzicoAuthorizationHeader(input: {
  apiKey: string
  secretKey: string
  randomKey: string
  uriPath: string
  body: string
}): string {
  const signature = iyzicoRequestSignature(input.secretKey, input.randomKey, input.uriPath, input.body)
  return encodeIyzicoAuthorization(input.apiKey, input.randomKey, signature)
}

export function encodeIyzicoAuthorization(apiKey: string, randomKey: string, signatureHex: string): string {
  const auth = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signatureHex}`
  return `IYZWSv2 ${Buffer.from(auth, 'utf8').toString('base64')}`
}

/** iyzico "trailing zero" rule for price fields in response signatures: "10.50" → "10.5", "10.0" → "10". */
export function iyzicoSignaturePrice(value: string | number): string {
  const text = typeof value === 'number' ? String(value) : value.trim()
  if (!/^\d+(\.\d+)?$/.test(text)) return text
  if (!text.includes('.')) return text
  return text.replace(/0+$/, '').replace(/\.$/, '')
}

export function iyzicoResponseSignature(secretKey: string, params: readonly string[]): string {
  return hmacSha256Hex(secretKey, params.join(':'))
}

export function verifyIyzicoResponseSignature(secretKey: string, params: readonly string[], received: unknown): boolean {
  if (typeof received !== 'string' || !received) return false
  return safeEqualHex(iyzicoResponseSignature(secretKey, params), received)
}

export type IyzicoWebhookPayload = {
  iyziEventType: string
  paymentConversationId: string
  status: string
  /** HPP format (Checkout Form). */
  token?: string
  iyziPaymentId?: string | number
  /** Direct format. */
  paymentId?: string | number
  iyziReferenceCode?: string
}

export type IyzicoWebhookFormat = 'hpp' | 'direct'

export function iyzicoWebhookFormat(payload: IyzicoWebhookPayload): IyzicoWebhookFormat {
  return payload.token ? 'hpp' : 'direct'
}

export function iyzicoWebhookSignature(secretKey: string, payload: IyzicoWebhookPayload): string {
  const format = iyzicoWebhookFormat(payload)
  const message =
    format === 'hpp'
      ? `${secretKey}${payload.iyziEventType}${payload.iyziPaymentId ?? ''}${payload.token ?? ''}${payload.paymentConversationId}${payload.status}`
      : `${secretKey}${payload.iyziEventType}${payload.paymentId ?? ''}${payload.paymentConversationId}${payload.status}`
  return hmacSha256Hex(secretKey, message)
}

export function verifyIyzicoWebhookSignature(
  secretKey: string,
  payload: IyzicoWebhookPayload,
  headerValue: string | null | undefined,
): boolean {
  if (!headerValue) return false
  return safeEqualHex(iyzicoWebhookSignature(secretKey, payload), headerValue.trim())
}
