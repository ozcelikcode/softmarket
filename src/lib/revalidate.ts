import type { CollectionConfig, GlobalConfig } from 'payload'

/** CLI/import uses the same hooks without a Next incremental cache. */
export async function revalidatePublicContent() {
  if (!process.env.NEXT_RUNTIME || process.env.NEXT_PHASE === 'phase-production-build') return
  try {
    const { revalidatePath } = await import('next/cache')
    // Layout invalidation covers every descendant, both old/new localized slugs,
    // all listing pages and cross-collection relationships (header, footer, blocks).
    revalidatePath('/tr', 'layout')
    revalidatePath('/en', 'layout')
    revalidatePath('/sitemap.xml')
  } catch (error) {
    // Local API/CLI can run in a process without a Next request/cache context.
    console.warn('[ISR] Cache invalidation unavailable; hourly revalidation remains active.', error instanceof Error ? error.message : 'Unknown error')
  }
}

export function withPublicRevalidation(config: CollectionConfig): CollectionConfig {
  return { ...config, hooks: { ...config.hooks,
    afterChange: [...(config.hooks?.afterChange ?? []), async ({ doc }) => { await revalidatePublicContent(); return doc }],
    afterDelete: [...(config.hooks?.afterDelete ?? []), async ({ doc }) => { await revalidatePublicContent(); return doc }],
  } }
}

export function withGlobalRevalidation(config: GlobalConfig): GlobalConfig {
  return { ...config, hooks: { ...config.hooks,
    afterChange: [...(config.hooks?.afterChange ?? []), async ({ doc }) => { await revalidatePublicContent(); return doc }],
  } }
}
