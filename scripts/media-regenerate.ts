import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { regenerateMedia } from '../src/lib/media-regenerate'

async function main() {
  if (process.argv.length > 2) throw new Error('Usage: pnpm media:regenerate')
  const payload = await getPayload({ config })
  try {
    console.log(await regenerateMedia(payload))
  } finally { await payload.destroy() }
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
