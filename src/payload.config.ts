import { searchFields } from './lib/search-index'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { withDbQueryLogging } from './lib/db-query-log'
import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { searchPlugin } from '@payloadcms/plugin-search'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { mcpOptions } from './lib/mcp'
import { withPublicRevalidation, withGlobalRevalidation } from './lib/revalidate'
import { LIVE_PREVIEW_BREAKPOINTS, LIVE_PREVIEW_COLLECTIONS, livePreviewURL } from './lib/preview-url'
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
import { CaseStudies } from './collections/CaseStudies'
import { Careers } from './collections/Careers'
import { Customers } from './collections/Customers'
import { Docs } from './collections/Docs'
import { Downloads } from './collections/Downloads'
import { Editions } from './collections/Editions'
import { Faqs } from './collections/Faqs'
import { Industries } from './collections/Industries'
import { Licenses } from './collections/Licenses'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Partners } from './collections/Partners'
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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const secret = process.env.PAYLOAD_SECRET || (isBuild ? 'build-only-placeholder' : '')
if (!secret) {
  throw new Error('PAYLOAD_SECRET is required at runtime.')
}

const SITE_NAME = 'SoftMarket'
const smtpHost = process.env.SMTP_HOST?.trim()
// Omitting email selects Payload's built-in console adapter, without DNS lookup.
const smtpConfigured = smtpHost && !smtpHost.startsWith('CHANGE_') && process.env.SMTP_FROM

const databaseAdapter = sqliteAdapter({
  push: false,
  client: { url: process.env.DATABASE_URI || 'file:./data/softmarket.db' },
  wal: true,
  busyTimeout: 5000,
  transactionOptions: { behavior: 'immediate' },
})

export default buildConfig({
  admin: {
    // Only `users` (admin/editor) can enter the panel; `customers` is portal-only.
    user: Users.slug,
    // Site icons live in public/ (F7: the frontend favicon is CMS-configurable, file-based app icons would override it).
    meta: { icons: [{ rel: 'icon', type: 'image/svg+xml', url: '/icon.svg' }] },
    importMap: {
      baseDir: path.resolve(dirname),
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
  ].map((collection) => ['users', 'customers', 'licenses', 'support-tickets', 'support-ticket-messages'].includes(collection.slug)
    ? collection : withPublicRevalidation(collection)),
  globals: [Header, Footer, SiteSettings].map(withGlobalRevalidation),
  editor: lexicalEditor(),
  secret,
  ...(smtpConfigured
    ? {
        email: nodemailerAdapter({
          defaultFromAddress: process.env.SMTP_FROM!,
          defaultFromName: SITE_NAME,
          transportOptions: {
            host: smtpHost,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
              ? {
                  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
                }
              : {}),
          },
        }),
      }
    : {}),
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: process.env.SM_DB_QUERY_LOG === '1' ? withDbQueryLogging(databaseAdapter) : databaseAdapter,
  sharp,
  plugins: [
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
        admin: { group: 'Forms' },
        access: {
          read: anyone,
          create: isAdminOrEditor,
          update: isAdminOrEditor,
          delete: isAdminOrEditor,
        },
      },
      formSubmissionOverrides: {
        admin: { group: 'Forms' },
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
        admin: { group: 'Content' },
        access: {
          read: publicSearchRead,
          create: nobody,
          update: isAdmin,
          delete: isAdmin,
        },
        fields: ({ defaultFields }) => [
          ...defaultFields,
          { name: 'slug', type: 'text', localized: true, admin: { readOnly: true } },
          { name: 'excerpt', type: 'textarea', localized: true, admin: { readOnly: true } },
        ],
      },
      beforeSync: ({ originalDoc, searchDoc }) => ({
        ...searchDoc,
        ...searchFields(originalDoc),
      }),
    }),
  ],
})
