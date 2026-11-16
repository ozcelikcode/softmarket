/**
 * Bounded raw-body reader for provider webhooks and the iyzico callback (plan §4.2, P1 QA item).
 *
 * The limit is enforced WHILE the stream is read: bytes are counted chunk by chunk and the stream is cancelled as
 * soon as the limit is exceeded, so an oversized or endless body is never buffered in full. Content-Length is only
 * used to reject early when it already declares too much; a smaller (or missing) declaration is never trusted.
 *
 * The bytes are decoded as strict UTF-8 without BOM stripping, so the returned string re-encodes to exactly the
 * received bytes and signatures are verified over the unmodified body. Invalid UTF-8 is `malformed`.
 */

export type LimitedBody = { ok: true; text: string } | { ok: false; reason: 'too_large' | 'malformed' }

export async function readLimitedBody(request: Request, maxBytes: number): Promise<LimitedBody> {
  const declared = request.headers.get('content-length')
  if (declared && /^\d+$/.test(declared.trim()) && Number(declared.trim()) > maxBytes) {
    await request.body?.cancel().catch(() => undefined)
    return { ok: false, reason: 'too_large' }
  }
  if (!request.body) return { ok: true, text: '' }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, reason: 'too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, reason: 'malformed' }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) }
  } catch {
    return { ok: false, reason: 'malformed' }
  }
}
