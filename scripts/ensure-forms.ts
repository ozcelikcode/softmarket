import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { FORM_KINDS, formTitle } from '../src/lib/forms/schema'
import tr from '../src/i18n/messages/tr.json'
import en from '../src/i18n/messages/en.json'

/** Stable title is the form identity: no extra schema, duplicate records or hard-coded DB IDs. */
const payload = await getPayload({ config })
try {
  for (const kind of FORM_KINDS) {
    const found = await payload.find({
      collection: 'forms',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { title: { equals: formTitle(kind) } },
    })
    let id = found.docs[0]?.id
    for (const locale of ['tr', 'en'] as const) {
      const labels = (locale === 'tr' ? tr : en).leadForm
      const names = [
        'name',
        'email',
        'company',
        'phone',
        'product',
        'sku',
        'message',
        'consent',
      ] as const
      const existing = id
        ? await payload.findByID({ collection: 'forms', id, locale, depth: 0 })
        : null
      const fields = names.map((name) => ({
        id: (existing?.fields ?? []).find((f) => 'name' in f && f.name === name)?.id,
        name,
        label: labels[name],
        required: ['name', 'email', 'message', 'consent'].includes(name),
        blockType:
          name === 'email'
            ? ('email' as const)
            : name === 'message'
              ? ('textarea' as const)
              : name === 'consent'
                ? ('checkbox' as const)
                : ('text' as const),
      }))
      const data = {
        title: formTitle(kind),
        fields,
        submitButtonLabel: labels.send,
        confirmationType: 'message' as const,
        confirmationMessage: {
          root: {
            type: 'root',
            version: 1,
            direction: null,
            format: '' as const,
            indent: 0,
            children: [
              {
                type: 'paragraph',
                version: 1,
                children: [{ type: 'text', text: labels.success, version: 1 }],
              },
            ],
          },
        },
        emails: [],
      }
      if (id) await payload.update({ collection: 'forms', id, locale, overrideAccess: true, data })
      else
        id = (await payload.create({ collection: 'forms', locale, overrideAccess: true, data })).id
    }
    console.log(`Ensured ${formTitle(kind)} (#${id})`)
  }
} finally {
  await payload.destroy()
}
// Payload plugins can retain background timers after closing the DB in a standalone CLI.
process.exit(0)
