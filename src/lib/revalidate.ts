import type { CollectionConfig, GlobalConfig, CollectionSlug } from 'payload'

/** CLI/import uses the same hooks without a Next incremental cache. */
export async function revalidatePublicContent() {
  if (!process.env.NEXT_RUNTIME || process.env.NEXT_PHASE === 'phase-production-build') return
  try {
    const { revalidatePath, revalidateTag } = await import('next/cache')
    // Root layout invalidation covers every descendant: both locales, old/new localized
    // slugs, the home page, landing/system pages, listings and cross-collection
    // relationships (header, footer, blocks). Next derives implicit cache tags from the
    // route file path (`/layout`, `/(frontend)/[locale]/layout` …) plus the URL pathname,
    // so `revalidatePath('/tr', 'layout')` (tag `/tr/layout`) matched no cached page (F6).
    revalidatePath('/', 'layout')
    revalidatePath('/sitemap.xml')
    revalidateTag('public-sitemap')
  } catch (error) {
    // Local API/CLI can run in a process without a Next request/cache context.
    console.warn('[ISR] Cache invalidation unavailable; hourly revalidation remains active.', error instanceof Error ? error.message : 'Unknown error')
  }
}

export function withPublicRevalidation(config: CollectionConfig): CollectionConfig {
  const drafts = typeof config.versions === 'object' && config.versions.drafts
  // previousDoc is the latest VERSION, which may be a draft over a published row.
  // Track the main row before a draft -> draft write so unpublish is not missed.
  const publishedBeforeChange = new WeakSet<object>()
  return { ...config, hooks: { ...config.hooks,
    beforeChange: [...(config.hooks?.beforeChange ?? []), async ({ data, originalDoc, operation, req }) => {
      if (drafts && operation === 'update' && originalDoc && originalDoc._status !== 'published' && data._status === 'draft') {
        const current = await req.payload.db.findOne({ collection: config.slug as CollectionSlug, req, where: { id: { equals: originalDoc.id } } })
        if ((current as { _status?: string } | null)?._status === 'published') publishedBeforeChange.add(originalDoc)
      }
      return data
    }],
    afterChange: [...(config.hooks?.afterChange ?? []), async ({ doc, previousDoc, req }) => {
      const wasPublished = previousDoc && (publishedBeforeChange.has(previousDoc) || previousDoc._status === 'published')
      if (previousDoc) publishedBeforeChange.delete(previousDoc)
      if (!drafts || doc._status === 'published') await revalidatePublicContent()
      else if (wasPublished) {
        // Drafts over published records only update the version table. An actual
        // unpublish also updates the main row, which must invalidate the cache.
        const current = await req.payload.db.findOne({ collection: config.slug as CollectionSlug, req, where: { id: { equals: doc.id } } })
        if (!current || (current as { _status?: string })._status !== 'published') await revalidatePublicContent()
      }
      return doc
    }],
    afterDelete: [...(config.hooks?.afterDelete ?? []), async ({ doc }) => { await revalidatePublicContent(); return doc }],
  } }
}

export function withGlobalRevalidation(config: GlobalConfig): GlobalConfig {
  // G1: a drafts-enabled global (header/footer) invalidates only when it publishes (also a published version
  // restore); draft/autosave saves write only the version table, which public reads never see. Unpublish
  // (`_status: 'draft'` on the main row) is refused by chrome-drafts.ts. Globals without drafts: every change.
  const drafts = typeof config.versions === 'object' && Boolean(config.versions.drafts)
  return { ...config, hooks: { ...config.hooks,
    afterChange: [...(config.hooks?.afterChange ?? []), async ({ doc }) => {
      // A version restore passes the stored version record; its `version._status` is authoritative (the record's
      // own top-level `_status` is only a field default).
      const status = doc?.version?._status ?? doc?._status
      if (!drafts || status === 'published') await revalidatePublicContent()
      return doc
    }],
  } }
}
