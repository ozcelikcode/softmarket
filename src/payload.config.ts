import { searchFields } from './lib/search-index'
import { assertIsolatedE2E } from './lib/e2e-isolation'
import { softmarketEmailAdapter } from './lib/email/adapter'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { withDbQueryLogging } from './lib/db-query-log'
import { withSerialTransactions } from './lib/db-serial-transactions'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { searchPlugin } from '@payloadcms/plugin-search'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { mcpOptions } from './lib/mcp'
import { ADMIN_GROUPS, COLLECTION_LABELS, loc, localizeCollection, localizeGlobal, localizeSeoFields } from './lib/admin-i18n'
import { withPublicRevalidation, withGlobalRevalidation } from './lib/revalidate'
import { LIVE_PREVIEW_BREAKPOINTS, LIVE_PREVIEW_COLLECTIONS, livePreviewURL } from './lib/preview-url'
import { payloadSessionConfig } from './lib/server-url'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { en } from 'payload/i18n/en'
import { tr } from 'payload/i18n/tr'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { anyone, isAdmin, isAdminOrEditor, nobody } from './access'
import { publicSearchRead } from './access/search'
import { visualEditor } from './editor/canvas/plugin'
import { CaseStudies } from './collections/CaseStudies'
import { Careers } from './collections/Careers'
import { Customers } from './collections/Customers'
import { Docs } from './collections/Docs'
import { Downloads } from './collections/Downloads'
import { Editions } from './collections/Editions'
import { Faqs } from './collections/Faqs'
import { Industries } from './collections/Industries'
import { Licenses } from './collections/Licenses'
import { LicenseActivations } from './collections/LicenseActivations'
import { LicenseStatusLog } from './collections/LicenseStatusLog'
import { SecurityAudit } from './collections/SecurityAudit'
import { SecurityBlocks } from './collections/SecurityBlocks'
import { SecurityEvents } from './collections/SecurityEvents'
import { Media } from './collections/Media'
import { Orders } from './collections/Orders'
import { Pages } from './collections/Pages'
import { Partners } from './collections/Partners'
import { PaymentEvents } from './collections/PaymentEvents'
import { Posts } from './collections/Posts'
import { ProductFamilies } from './collections/ProductFamilies'
import { Products } from './collections/Products'
import { Releases } from './collections/Releases'
import { Solutions } from './collections/Solutions'
import { SupportTicketMessages } from './collections/SupportTicketMessages'
import { SupportTickets } from './collections/SupportTickets'
import { Users } from './collections/Users'
import { Footer } from './globals/Footer'
import { Header } from './globals/Header'
import { SiteSettings } from './globals/SiteSettings'
import { Integrations } from './globals/Integrations'
import { LicensingSettings } from './globals/LicensingSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// A missing test DB/uploads variable must never fall back to the live defaults or .env values.
// 3400 is reserved for this runner, including when all isolation variables were lost.
if (process.env.PORT === '3400' || process.env.E2E_ISOLATED !== undefined || process.env.E2E_ISOLATED_DIR !== undefined) assertIsolatedE2E()

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const secret = process.env.PAYLOAD_SECRET || (isBuild ? 'build-only-placeholder' : '')
if (!secret) {
  throw new Error('PAYLOAD_SECRET is required at runtime.')
}

const SITE_NAME = 'SoftMarket'

const pluginLabels = (slug: string) => {
  const l = COLLECTION_LABELS[slug]
  return { singular: loc(l[0], l[1]), plural: loc(l[2], l[3]) }
}


// Transactions of this process are queued (one SQLite writer; see src/lib/db-serial-transactions.ts).
const databaseAdapter = withSerialTransactions(sqliteAdapter({
  push: false,
  client: { url: process.env.DATABASE_URI || 'file:./data/softmarket.db' },
  afterSchemaInit: [({ schema }) => {
    // The forward revert preserves the nullable DB column, while Payload still requires a footer column title.
    Object.assign(schema.tables.footer_columns_locales!.title, { notNull: false })
    return schema
  }],
  wal: true,
  busyTimeout: 5000,
  transactionOptions: { behavior: 'immediate' },
}), { timeoutMs: 5000 })

export default buildConfig({
  csrf: payloadSessionConfig().csrf,
  admin: {
    // Only `users` (admin/editor) can enter the panel; `customers` is portal-only.
    user: Users.slug,
    // Site icons live in public/ (F7: the frontend favicon is CMS-configurable, file-based app icons would override it).
    meta: { icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/icon.svg' }] },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    // L6a: read-only security center at /admin/guvenlik. The view enforces the admin-panel-session rule on the server
    // (editors are redirected); the nav link is cosmetic (admins only). See src/admin/security/guard.ts.
    components: {
      afterNavLinks: ['@/admin/security/SecurityNavLink#SecurityNavLink'],
      views: {
        securityCenter: {
          Component: '@/admin/security/SecurityCenterView#SecurityCenterView',
          path: '/guvenlik',
          exact: true,
          meta: { title: 'Güvenlik merkezi / Security center' },
        },
      },
    },
    // F8: staff-only draft preview (iframe -> /api/preview -> locale path). See src/lib/preview-url.ts.
    livePreview: {
      collections: [...LIVE_PREVIEW_COLLECTIONS],
      breakpoints: LIVE_PREVIEW_BREAKPOINTS,
      url: livePreviewURL,
    },
  },
  // Admin UI language (separate from content localization). TR first; editors may switch to EN.
  i18n: {
    fallbackLanguage: 'tr',
    supportedLanguages: { tr, en },
  },
  localization: {
    locales: [
      { code: 'tr', label: 'Türkçe' },
      { code: 'en', label: 'English' },
    ],
    defaultLocale: 'tr',
    fallback: true,
  },
  collections: [
    // Identity
    Users,
    Customers,
    // Catalog
    ProductFamilies,
    Products,
    Editions,
    // Marketing
    Solutions,
    Industries,
    CaseStudies,
    Posts,
    Careers,
    Partners,
    Pages,
    Media,
    // Support
    Docs,
    Releases,
    Downloads,
    Faqs,
    SupportTickets,
    SupportTicketMessages,
    // License assignment
    Licenses,
    // Sales (P2-S schema; server-written, never public, not in the MCP allowlist)
    Orders,
    PaymentEvents,
    // Licensing core (L1; server-written, admin panel read only, never public, not in the MCP allowlist)
    LicenseActivations,
    LicenseStatusLog,
    SecurityEvents,
    SecurityBlocks,
    SecurityAudit,
  ].map(localizeCollection).map((collection) => [
    'users', 'customers', 'licenses', 'support-tickets', 'support-ticket-messages', 'orders', 'payment-events',
    'license-activations', 'license-status-log', 'security-events', 'security-blocks', 'security-audit',
  ].includes(collection.slug) ? collection : withPublicRevalidation(collection)),
  // `integrations` (keys, SMTP) affects no public page: no revalidation wrapper, never in MCP (src/lib/mcp.ts).
  // `licensing-settings` (L1) likewise: admin panel only, no revalidation, not in MCP.
  globals: [...[Header, Footer, SiteSettings].map(localizeGlobal).map(withGlobalRevalidation), localizeGlobal(Integrations), localizeGlobal(LicensingSettings)],
  editor: lexicalEditor(),
  secret,
  // SMTP is resolved on every send (env first, else the admin panel `integrations` global, else console-style log
  // without the body): src/lib/email/adapter.ts. No connection is opened at init.
  email: softmarketEmailAdapter(),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: process.env.SM_DB_QUERY_LOG === '1' ? withDbQueryLogging(databaseAdapter) : databaseAdapter,
  sharp,
  plugins: [
    // V5 visual editor: products/pages open in the Live Preview canvas + editor host (admin UI only).
    visualEditor(),
    mcpPlugin(mcpOptions),
    seoPlugin({
      collections: [
        'pages',
        'products',
        'product-families',
        'solutions',
        'industries',
        'case-studies',
        'posts',
        'careers',
        'docs',
      ],
      uploadsCollection: 'media',
      tabbedUI: true,
      fields: localizeSeoFields,
      generateTitle: ({ doc }) => (doc?.title ? `${doc.title} | ${SITE_NAME}` : SITE_NAME),
      generateDescription: ({ doc }) => doc?.summary ?? doc?.excerpt ?? '',
    }),
    formBuilderPlugin({
      fields: { payment: false },
      // Notifications use fixed server-owned headers in the submission action.
      beforeEmail: () => [],
      redirectRelationships: ['pages'],
      formOverrides: {
        hooks: { afterChange: [async ({ doc }) => { const { revalidatePublicContent } = await import('./lib/revalidate'); await revalidatePublicContent(); return doc }], afterDelete: [async ({ doc }) => { const { revalidatePublicContent } = await import('./lib/revalidate'); await revalidatePublicContent(); return doc }] },
        labels: pluginLabels('forms'),
        admin: { group: ADMIN_GROUPS.forms },
        access: {
          read: anyone,
          create: isAdminOrEditor,
          update: isAdminOrEditor,
          delete: isAdminOrEditor,
        },
      },
      formSubmissionOverrides: {
        labels: pluginLabels('form-submissions'),
        admin: { group: ADMIN_GROUPS.forms },
        access: {
          // Only the validated server action creates submissions.
          create: nobody,
          read: isAdminOrEditor,
          update: nobody,
          delete: isAdmin,
        },
      },
    }),
    searchPlugin({
      collections: ['products', 'docs', 'faqs', 'posts'],
      localize: true,
      syncDrafts: false,
      deleteDrafts: true,
      defaultPriorities: { products: 40, docs: 30, faqs: 20, posts: 10 },
      searchOverrides: {
        labels: pluginLabels('search'),
        admin: { group: ADMIN_GROUPS.content },
        access: {
          read: publicSearchRead,
          create: nobody,
          update: isAdmin,
          delete: isAdmin,
        },
        fields: ({ defaultFields }) => [
          ...defaultFields,
          { name: 'slug', type: 'text', localized: true, label: loc('Slug (sayfa adresi)', 'Slug'), admin: { readOnly: true } },
          { name: 'excerpt', type: 'textarea', localized: true, label: loc('Kısa özet', 'Excerpt'), admin: { readOnly: true } },
        ],
      },
      beforeSync: ({ originalDoc, searchDoc }) => ({
        ...searchDoc,
        ...searchFields(originalDoc),
      }),
    }),
  ],
})
