import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { APIError, type CollectionBeforeOperationHook } from 'payload'
import sharp from 'sharp'

const rasterMime = /^image\/(jpeg|png|webp|tiff|heic|heif)$/i
const rasterExtension = /\.(jpe?g|png|webp|tiff?|heic|heif)$/i

/** Runs before Payload snapshots the original buffer and generates derivatives. */
export const sanitizeMediaUpload: CollectionBeforeOperationHook = async ({ operation, req }) => {
  const file = req.file
  if (!['create', 'update'].includes(operation) || !file) return
  if (!rasterMime.test(file.mimetype) && !rasterExtension.test(extname(file.name))) return

  try {
    const source = file.tempFilePath ? await readFile(file.tempFilePath) : file.data
    const image = sharp(source, { animated: true })
    const { format, compression } = await image.metadata()
    const clean = image.rotate().keepIccProfile()
    switch (format) {
      case 'jpeg': clean.jpeg({ quality: 90, mozjpeg: true }); break
      case 'png': clean.png(); break
      case 'webp': clean.webp({ lossless: true }); break
      case 'tiff': clean.tiff({ compression: 'lzw' }); break
      case 'heif':
        // HEIC is available only with a libvips build that supports HEVC encoding.
        if (compression !== 'hevc') throw new Error('Unsupported HEIF compression')
        clean.heif({ compression: 'hevc', lossless: true })
        break
      default: throw new Error('Unsupported raster format')
    }
    // Sharp strips all metadata by default; keepIccProfile retains only colour data.
    const data = await clean.toBuffer()
    const metadata = await sharp(data, { animated: true }).metadata()
    if (metadata.exif || metadata.xmp || metadata.iptc || (metadata.orientation && metadata.orientation !== 1)) {
      throw new Error('Raster metadata was not removed')
    }
    // Never let Payload read the unsanitized temporary file instead of this buffer.
    req.file = { ...file, data, size: data.length, tempFilePath: undefined }
  } catch {
    throw new APIError('Görsel metadata temizliği başarısız; dosya yüklenmedi.', 400)
  }
}
