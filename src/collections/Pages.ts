import type { Access, CollectionConfig, TextFieldSingleValidation, Where } from 'payload'

import { isAdminOrEditor, isAdminOrEditorUser } from '@/access'
import { draftVersions, pageLayoutField, publishedAtField } from '@/fields/common'
import { linkField } from '@/fields/link'
import { slugField } from '@/fields/slug'
import { HOME_SLUG, isReservedSlug, isSystemKey, LANDING_PAGE_TYPES, SYSTEM_KEYS, SYSTEM_PAGES } from '@/lib/system-pages'

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
  versions: draftVersions,
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
