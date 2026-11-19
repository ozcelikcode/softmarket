import { ValidationError, type Access, type CollectionBeforeValidateHook, type CollectionConfig, type TextFieldSingleValidation, type Where } from 'payload'

import { isAdminOrEditor, isAdminOrEditorField, isAdminOrEditorUser, isPanelAdminField } from '@/access'
import { nextApprovalHash, type LegalReview } from '@/lib/legal-approval'
import { pageLayoutField, publishedAtField } from '@/fields/common'
import { linkField } from '@/fields/link'
import { slugField } from '@/fields/slug'
import { HOME_SLUG, isReservedSlug, isSystemKey, LANDING_PAGE_TYPES, SYSTEM_KEYS, SYSTEM_PAGES } from '@/lib/system-pages'

export const PAGES_AUTOSAVE_INTERVAL = 2000

const reviewAccess = { read: isAdminOrEditorField, create: isPanelAdminField, update: isPanelAdminField }

const L = (tr: string, en: string) => ({ tr, en })
const opt = (value: string, tr: string, en: string) => ({ value, label: L(tr, en) })

const SYSTEM_LABELS: Record<(typeof SYSTEM_KEYS)[number], [string, string]> = {
  products: ['Ürünler', 'Products'],
  solutions: ['Çözümler', 'Solutions'],
  news: ['Haberler', 'News'],
  customers: ['Referanslar', 'Customers'],
  careers: ['Kariyer', 'Careers'],
  partners: ['İş ortakları', 'Partners'],
  support: ['Destek merkezi', 'Support center'],
  contact: ['İletişim', 'Contact'],
  about: ['Hakkımızda', 'About'],
}

/** Published pages for everyone except templates; staff read everything (drafts, templates). */
export const pagesRead: Access = ({ req: { user } }) => {
  if (isAdminOrEditorUser(user)) return true
  const where: Where = {
    and: [
      { _status: { equals: 'published' } },
      // NULL-safe: SQL `<>` drops rows without a type.
      { or: [{ pageType: { not_equals: 'template' } }, { pageType: { exists: false } }] },
    ],
  }
  return where
}

/** Landing slugs must not shadow a route in either locale (`/urunler`, `/products`, `/hesap` …). */
const validatePageSlug: TextFieldSingleValidation = async (value, options) => {
  const data = (options.data ?? {}) as { pageType?: unknown; systemKey?: unknown }
  const pageType = typeof data.pageType === 'string' ? data.pageType : 'standard'
  const routed = !isSystemKey(data.systemKey) && (LANDING_PAGE_TYPES as readonly string[]).includes(pageType)
  if (routed && value && value !== HOME_SLUG && isReservedSlug(value)) {
    return options.req?.i18n?.language === 'en'
      ? `"${value}" is a site route; choose another slug (or set a system page).`
      : `"${value}" bir site yolu; başka bir slug seçin (ya da sistem sayfası belirleyin).`
  }
  return true
}

export const COMMERCE_LEGAL_KINDS = ['distanceSales', 'preInformation', 'refund'] as const
const COMMERCE_LEGAL_LABELS: Record<(typeof COMMERCE_LEGAL_KINDS)[number], [string, string]> = {
  distanceSales: ['Mesafeli satış sözleşmesi', 'Distance sales agreement'],
  preInformation: ['Ön bilgilendirme formu', 'Pre-information form'],
  refund: ['İade ve cayma politikası', 'Refund and withdrawal policy'],
}

/**
 * `commerceLegal` is meaningful only on legal pages and each kind may belong to one page (plan §5). The DB unique
 * index backs it, but drafts live in `_pages_v`, so the check also runs here with a localized message.
 */
const enforceCommerceLegal: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const id = (originalDoc as { id?: number | string } | undefined)?.id
  if (!data) return data
  const type = ('pageType' in data ? data.pageType : originalDoc?.pageType) as string | undefined
  const kind = 'commerceLegal' in data ? data.commerceLegal : originalDoc?.commerceLegal
  if (type !== 'legal') {
    data.commerceLegal = null
    return data
  }
  if (kind == null || kind === '') {
    if ('commerceLegal' in data) data.commerceLegal = null
    return data
  }
  // Payload skips built-in select validation on autosaved drafts.
  if (!(COMMERCE_LEGAL_KINDS as readonly unknown[]).includes(kind)) {
    throw new ValidationError({ collection: 'pages', req, errors: [{ path: 'commerceLegal',
      message: req.i18n?.language === 'en' ? 'Invalid sales legal type.' : 'Geçersiz satış yasal türü.',
    }] }, req.t)
  }
  // A draft may reserve a different kind from the published document. Check both snapshots, within the
  // caller's serialized write transaction; a UNIQUE version index would also reject this page's own history.
  for (const draft of [false, true]) {
    const clash = await req.payload.find({
      collection: 'pages', depth: 0, limit: 1, pagination: false, overrideAccess: true, draft, req,
      where: { and: [{ commerceLegal: { equals: kind } }, ...(id ? [{ id: { not_equals: id } }] : [])] },
      select: { commerceLegal: true },
    })
    if (clash.docs.length) {
      const en = req.i18n?.language === 'en'
      throw new ValidationError({
        collection: 'pages',
        errors: [{
          path: 'commerceLegal',
          message: en ? 'Another page already uses this sales legal type; only one page per type.' : 'Bu satış yasal türünü başka bir sayfa kullanıyor; her tür için yalnız bir sayfa olabilir.',
        }],
        req,
      }, req.t)
    }
  }
  return data
}

/** Free-form block pages: home, landing pages, system page copy (F6), legal texts and templates. */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'pageType', 'systemKey', '_status', 'updatedAt'], group: 'Content' },
  access: {
    read: pagesRead,
    readVersions: isAdminOrEditor,
    create: isAdminOrEditor,
    update: isAdminOrEditor,
    delete: isAdminOrEditor,
  },
  // F8: autosave (~2 s) drives Live Preview. Autosaved drafts only write `_pages_v`; the revalidation hook
  // skips them (src/lib/revalidate.ts), so they never purge the ISR cache.
  hooks: { beforeValidate: [enforceCommerceLegal] },
  versions: { maxPerDoc: 50, drafts: { autosave: { interval: PAGES_AUTOSAVE_INTERVAL } } },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', localized: true, required: true },
            {
              name: 'hero',
              type: 'group',
              label: L('Sayfa başlığı (hero)', 'Page header (hero)'),
              admin: {
                condition: (data) => isSystemKey(data?.systemKey),
                description: L(
                  'Sistem sayfasının üst bölümü. Boş alanlar sitenin varsayılan metniyle doldurulur.',
                  'Top section of the system page. Empty fields fall back to the site default copy.',
                ),
              },
              fields: [
                { name: 'eyebrow', type: 'text', localized: true, label: L('Üst etiket', 'Eyebrow') },
                { name: 'title', type: 'text', localized: true, label: L('Başlık', 'Title') },
                { name: 'lead', type: 'textarea', localized: true, label: L('Açıklama', 'Lead') },
                {
                  name: 'actions',
                  type: 'array',
                  maxRows: 2,
                  label: L('Butonlar', 'Actions'),
                  labels: { singular: L('Buton', 'Action'), plural: L('Butonlar', 'Actions') },
                  fields: [linkField({ withAppearance: true })],
                },
              ],
            },
            pageLayoutField({
              admin: {
                description: L(
                  'Bloklar sürükle-bırak ile sıralanır. Ana sayfa ve landing sayfalarında ilk "Giriş (Hero)" bloğu sayfa başlığıdır. Sistem sayfasında "Sayfa listesi" bloğu listenin yerini belirler.',
                  'Drag blocks to reorder. On the home and landing pages the first Hero block is the page title. On a system page the "Page list" block places the list.',
                ),
              },
            }),
          ],
        },
      ],
    },
    slugField({
      overrides: {
        admin: {
          position: 'sidebar',
          description: 'Use "home" for the homepage. Generated from title when empty.',
        },
      },
    }),
    {
      name: 'pageType',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Legal', value: 'legal' },
        { label: 'Landing', value: 'landing' },
        { label: L('Şablon (yayınlanmaz)', 'Template (never public)'), value: 'template' },
      ],
      admin: {
        position: 'sidebar',
        description: L(
          'Standard/Landing: /<slug> adresinde yayınlanır. Şablon: sitede görünmez; "Çoğalt" ile yeni sayfa başlatın.',
          'Standard/Landing: published at /<slug>. Template: never public; start new pages with "Duplicate".',
        ),
      },
    },
    {
      name: 'systemKey',
      type: 'select',
      unique: true,
      index: true,
      label: L('Sistem sayfası', 'System page'),
      options: SYSTEM_KEYS.map((key) => opt(key, `${SYSTEM_LABELS[key][0]} (${SYSTEM_PAGES[key]})`, SYSTEM_LABELS[key][1])),
      hooks: { beforeDuplicate: [() => null] },
      admin: {
        position: 'sidebar',
        description: L(
          'Bu kaydı sabit bir sayfaya bağlar: başlık bölümü ve bloklar o sayfada görünür. Her sistem sayfası için tek kayıt.',
          'Binds this record to a fixed route: its header and blocks render there. One record per system page.',
        ),
      },
    },
    {
      name: 'commerceLegal',
      type: 'select',
      unique: true,
      index: true,
      label: L('Satış yasal sayfası türü', 'Sales legal page type'),
      options: COMMERCE_LEGAL_KINDS.map((key) => opt(key, COMMERCE_LEGAL_LABELS[key][0], COMMERCE_LEGAL_LABELS[key][1])),
      hooks: { beforeDuplicate: [() => null] },
      admin: {
        position: 'sidebar',
        condition: (data) => data?.pageType === 'legal',
        description: L(
          'Boş = satış yasal sayfası değil. Seçilen türler yalnız ödeme modu açıkken görünür; her tür tek sayfada olabilir.',
          'Empty = not a sales legal page. Marked pages are visible only while payments are open; one page per type.',
        ),
      },
    },
    {
      // Lawyer approval (P7 QA: removing the banner/placeholders proves no review). Bound to the text: see
      // src/lib/legal-approval.ts. Staff read; only an admin PANEL session writes (API key/MCP/import cannot).
      name: 'legalReview',
      type: 'group',
      label: L('Hukukçu onayı', 'Legal review'),
      custom: { contentImport: false },
      admin: {
        position: 'sidebar',
        condition: (data) => data?.pageType === 'legal',
        description: L(
          'Hukukçu bu dildeki metni onayladığında doldurun (yalnız yönetici). Metin sonradan değişirse onay geçersiz olur; yeniden onay için tarihi güncelleyin. Satış sayfaları onaysız yayına alınamaz.',
          'Fill in when a lawyer approved this language version (admins only). Any later text change voids the approval; update the date to approve again. Sales pages cannot go live without it.',
        ),
      },
      fields: [
        { name: 'approvedBy', type: 'text', localized: true, label: L('Onaylayan', 'Approved by'), access: reviewAccess },
        { name: 'approvedAt', type: 'date', localized: true, label: L('Onay tarihi', 'Approved at'), access: reviewAccess, admin: { date: { pickerAppearance: 'dayOnly' } } },
        {
          name: 'approvedHash',
          type: 'text',
          localized: true,
          admin: { hidden: true, readOnly: true },
          access: { read: isAdminOrEditorField },
          hooks: {
            // Never taken from input: recomputed from the approval fields and the saved title/text.
            beforeChange: [({ siblingData, previousSiblingDoc, data, originalDoc }) => nextApprovalHash({
              review: siblingData as LegalReview,
              previous: previousSiblingDoc as LegalReview,
              title: data?.title ?? originalDoc?.title,
              layout: data?.layout ?? originalDoc?.layout,
            })],
          },
        },
      ],
    },
    publishedAtField,
  ],
}

// Slug validation is page specific (reserved route segments) on top of the shared format/uniqueness rules.
const slug = Pages.fields.find((f) => 'name' in f && f.name === 'slug') as { validate?: TextFieldSingleValidation } | undefined
if (slug) {
  const base = slug.validate
  slug.validate = async (value, options) => {
    const reserved = await validatePageSlug(value, options)
    if (reserved !== true) return reserved
    return base ? base(value, options) : true
  }
}
