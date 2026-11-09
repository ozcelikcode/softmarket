import type { CollectionConfig, Plugin } from 'payload'

import { VISUAL_EDITOR_COLLECTIONS } from '@/editor/canvas/rules'

export const VISUAL_EDITOR_HOST = '@/editor/canvas/admin/host#VisualEditorHost'

/**
 * V5 visual editor: admin configuration only (no schema change). For each first-wave collection:
 * - `admin.livePreview.openByDefault`: the document opens in the Live Preview split (Payload 3.86+ public option;
 *   merged with the root `admin.livePreview` url/breakpoints). Payload remembers a user's switch to the classic
 *   form per collection (`editViewType` preference); the editor bar switches back with one click.
 * - `beforeDocumentControls`: the editor host (inside the document Form, so the public form hooks work).
 */
export const visualEditor = (collections: readonly string[] = VISUAL_EDITOR_COLLECTIONS): Plugin => (config) => ({
  ...config,
  collections: config.collections?.map((c: CollectionConfig) =>
    collections.includes(c.slug)
      ? {
          ...c,
          admin: {
            ...c.admin,
            livePreview: { ...c.admin?.livePreview, openByDefault: true },
            components: {
              ...c.admin?.components,
              edit: {
                ...c.admin?.components?.edit,
                beforeDocumentControls: [...(c.admin?.components?.edit?.beforeDocumentControls ?? []), VISUAL_EDITOR_HOST],
              },
            },
          },
        }
      : c,
  ),
})
