import type { Locale } from '@/i18n/routing'
import { getPayloadClient, safe } from '@/lib/site'
import { formTitle, type FormKind } from './schema'

export const getLeadForm = (kind: FormKind, locale: Locale) =>
  safe(async () => {
    const r = await (
      await getPayloadClient()
    ).find({
      collection: 'forms',
      locale,
      overrideAccess: false,
      user: null,
      draft: false,
      depth: 0,
      limit: 1,
      where: { title: { equals: formTitle(kind) } },
      select: { title: true, fields: true, submitButtonLabel: true },
    })
    return r.docs[0] ?? null
  }, null)
