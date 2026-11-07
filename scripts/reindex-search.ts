import 'dotenv/config'
import { createLocalReq, getPayload, initTransaction, commitTransaction, killTransaction } from 'payload'
import config from '../src/payload.config'
import { searchFields } from '../src/lib/search-index'

const payload = await getPayload({ config })
const req = await createLocalReq({}, payload)
try {
  await initTransaction(req)
  // Only rebuild derived data. Sources and their version history stay untouched.
  await payload.delete({ collection: 'search', where: {}, overrideAccess: true, req })
  for (const [collection, priority] of [['products', 40], ['docs', 30], ['faqs', 20], ['posts', 10]] as const) {
    const records = await payload.find({
      collection, locale: 'tr', overrideAccess: true, draft: false, depth: 0,
      pagination: false, req,
      where: collection === 'faqs' ? undefined : { _status: { equals: 'published' } },
    })
    for (const record of records.docs) {
      let id: number | undefined
      for (const locale of ['tr', 'en'] as const) {
        const doc = await payload.findByID({ collection, id: record.id, locale, fallbackLocale: false, depth: 0, overrideAccess: true, req })
        const data = { ...searchFields(doc), priority, doc: { relationTo: collection, value: record.id } }
        if (id) await payload.update({ collection: 'search', id, locale, overrideAccess: true, data, req })
        else id = (await payload.create({ collection: 'search', locale, overrideAccess: true, data, req })).id
      }
    }
    console.log(`${collection}: ${records.docs.length} indexed (tr/en)`)
  }
  await commitTransaction(req)
} catch (error) {
  await killTransaction(req)
  throw error
} finally {
  await payload.destroy()
}
process.exit(0)
