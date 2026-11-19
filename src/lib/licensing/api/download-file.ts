import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'

const fileFlags = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
const directoryFlags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
const darwinNoFollowAny = 0x20000000 // Darwin's O_NOFOLLOW_ANY rejects symlinks in every component.
const chunkSize = 64 * 1024

export function safeUploadName(name: string | null): name is string {
  return Boolean(name && name !== '.' && name !== '..' && !/[/\\\p{Cc}]|%[a-f\d]{2}/iu.test(name)
    && !/^[a-z]:/i.test(name) && Buffer.byteLength(name) <= 255)
}

async function openUpload(root: string, filename: string) {
  if (process.platform === 'darwin') return open(join(root, filename), constants.O_NONBLOCK | darwinNoFollowAny)
  if (process.platform !== 'linux') throw new Error('licensing_upload_platform')

  // Node does not expose openat. The procfs fd link anchors each lookup to the open parent
  // directory. O_NOFOLLOW then applies to the next component, including the final file.
  let dir = await open(sep, directoryFlags)
  try {
    for (const component of root.split(sep).filter(Boolean)) {
      const next = await open(`/proc/self/fd/${dir.fd}/${component}`, directoryFlags)
      await dir.close()
      dir = next
    }
    return await open(`/proc/self/fd/${dir.fd}/${filename}`, fileFlags)
  } finally {
    await dir.close()
  }
}

export async function openDownloadFile(
  filename: string | null,
  uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads'),
) {
  if (!safeUploadName(filename)) return null
  const configured = resolve(uploadsDir)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    // The configured root is operator-controlled and is a symlink in the release layout
    // (scripts/deploy.sh links releases/<id>/uploads to shared/uploads). Resolve it once to the
    // physical directory; the descriptor walk below still rejects any symlink that appears later.
    const root = await realpath(configured)
    if (root === sep) return null
    handle = await openUpload(root, filename)
    const stat = await handle.stat({ bigint: true })
    if (stat.isFile() && stat.nlink === 1n && stat.ino !== 0n && stat.size <= BigInt(Number.MAX_SAFE_INTEGER)) {
      // SQLite identifies names byte-for-byte. Case- or normalization-insensitive volumes
      // can otherwise resolve a different catalog name to this same original or derivative.
      const fdPath = process.platform === 'darwin' ? `/dev/fd/${handle.fd}` : `/proc/self/fd/${handle.fd}`
      if (basename(await realpath(fdPath)) !== filename) {
        await handle.close()
        return null
      }
      const version = [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':')
      const etag = `"${createHash('sha256').update(version).digest('base64url')}"`
      return { handle, size: Number(stat.size), etag, modified: new Date(Number(stat.mtimeMs)).toUTCString() }
    }
  } catch {
    // Unavailable paths and rejected filesystem objects have the same client-facing outcome.
  }
  await handle?.close()
  return null
}

type ByteRange = { start: number; end: number }
type DownloadFile = NonNullable<Awaited<ReturnType<typeof openDownloadFile>>>

/** null is a full response, false is a rejected/unsatisfiable range. */
export function downloadRange(headers: Headers, { size, etag }: DownloadFile): ByteRange | null | false {
  const raw = headers.get('range')
  const validator = headers.get('if-range')
  if (raw === null || (validator !== null && validator !== etag)) return null
  if (raw.length > 256 || size === 0) return false
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw)
  if (!match || (!match[1] && !match[2])) return false
  const last = BigInt(size - 1)
  if (!match[1]) {
    const suffix = BigInt(match[2]!)
    return suffix === 0n ? false : { start: Number(suffix > last ? 0n : last + 1n - suffix), end: Number(last) }
  }
  const start = BigInt(match[1])
  const end = match[2] ? BigInt(match[2]) : last
  if (start > last || end < start) return false
  return { start: Number(start), end: Number(end > last ? last : end) }
}

export function attachment(filename: string): string {
  const name = Buffer.from(filename).toString('utf8').replace(/[\p{Cc}\p{Cf}/\\]/gu, '_').trim() || 'download'
  const fallback = name.replace(/[^ -~]|["%\\]/gu, '_')
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export function fileResponseHeaders(file: DownloadFile, filename: string, mime: string | null) {
  return {
    'Content-Type': mime && mime.trim() === mime && /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(mime)
      ? mime : 'application/octet-stream',
    'Content-Disposition': attachment(filename),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store, no-transform',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
    'Referrer-Policy': 'no-referrer',
    ETag: file.etag,
    'Last-Modified': file.modified,
  }
}

export function streamDownload(file: DownloadFile, signal: AbortSignal, range: ByteRange | null) {
  const stream = file.handle.createReadStream({
    start: range?.start ?? 0,
    end: range?.end ?? file.size - 1,
    highWaterMark: chunkSize,
    signal,
    autoClose: true,
  })
  // Web streams otherwise count each Buffer as one unit rather than its byte length.
  return Readable.toWeb(stream, {
    strategy: { highWaterMark: chunkSize, size: (chunk: Buffer) => chunk.byteLength },
  }) as ReadableStream<Uint8Array<ArrayBuffer>>
}
