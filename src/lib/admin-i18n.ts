import type { CollectionConfig, Field, GlobalConfig } from 'payload'

/*
 * F10 admin labels: a single TR/EN dictionary applied to every collection and global in payload.config.
 * Only `label`, `labels`, `description`, select option labels, tab labels and `admin.group` are touched.
 * Field names, values and defaultValue never change, so the DB schema is unaffected (no migration).
 *
 * Lookup order for a field: `<collection>:<dotted.path>` -> `<collection>:<name>` -> `*:<name>`.
 * Existing `{ tr, en }` labels (blocks, link field, hand-written fields) are kept as they are.
 */

export type Localized = { tr: string; en: string }
/** [labelTr, labelEn, descriptionTr?, descriptionEn?] */
type Entry = readonly [string, string, string?, string?]
/** [singularTr, singularEn, pluralTr, pluralEn] */
type RowEntry = readonly [string, string, string, string]

export const loc = (tr: string, en: string): Localized => ({ tr, en })

export const ADMIN_GROUPS = {
  admin: loc('Yönetim', 'Admin'),
  customers: loc('Müşteriler', 'Customers'),
  catalog: loc('Katalog', 'Catalog'),
  marketing: loc('Pazarlama', 'Marketing'),
  content: loc('İçerik', 'Content'),
  support: loc('Destek', 'Support'),
  licenses: loc('Lisanslar', 'Licenses'),
  site: loc('Site', 'Site'),
  forms: loc('Formlar', 'Forms'),
} as const

const GROUP_BY_LEGACY: Record<string, Localized> = {
  Admin: ADMIN_GROUPS.admin,
  Customers: ADMIN_GROUPS.customers,
  Catalog: ADMIN_GROUPS.catalog,
  Marketing: ADMIN_GROUPS.marketing,
  Content: ADMIN_GROUPS.content,
  Support: ADMIN_GROUPS.support,
  Licenses: ADMIN_GROUPS.licenses,
  Site: ADMIN_GROUPS.site,
  Forms: ADMIN_GROUPS.forms,
}

/** Collection labels `[singularTr, singularEn, pluralTr, pluralEn]`. */
export const COLLECTION_LABELS: Record<string, RowEntry> = {
  users: ['Kullanıcı', 'User', 'Kullanıcılar', 'Users'],
  customers: ['Müşteri', 'Customer', 'Müşteriler', 'Customers'],
  'product-families': ['Ürün ailesi', 'Product family', 'Ürün aileleri', 'Product families'],
  products: ['Ürün', 'Product', 'Ürünler', 'Products'],
  editions: ['Lisans sürümü', 'Edition', 'Lisans sürümleri', 'Editions'],
  solutions: ['Çözüm', 'Solution', 'Çözümler', 'Solutions'],
  industries: ['Sektör', 'Industry', 'Sektörler', 'Industries'],
  'case-studies': ['Referans', 'Case study', 'Referanslar', 'Case studies'],
  posts: ['Haber', 'Post', 'Haberler', 'Posts'],
  careers: ['İş ilanı', 'Job opening', 'İş ilanları', 'Job openings'],
  partners: ['İş ortağı', 'Partner', 'İş ortakları', 'Partners'],
  pages: ['Sayfa', 'Page', 'Sayfalar', 'Pages'],
  media: ['Medya dosyası', 'Media file', 'Medya', 'Media'],
  docs: ['Doküman', 'Doc', 'Dokümanlar', 'Docs'],
  releases: ['Sürüm notu', 'Release', 'Sürüm notları', 'Releases'],
  downloads: ['İndirme', 'Download', 'İndirmeler', 'Downloads'],
  faqs: ['Sık sorulan soru', 'FAQ', 'Sık sorulan sorular', 'FAQs'],
  'support-tickets': ['Destek talebi', 'Support ticket', 'Destek talepleri', 'Support tickets'],
  'support-ticket-messages': ['Talep mesajı', 'Ticket message', 'Talep mesajları', 'Ticket messages'],
  licenses: ['Lisans', 'License', 'Lisanslar', 'Licenses'],
  // Plugin collections (labels set through plugin overrides in payload.config).
  forms: ['Form', 'Form', 'Formlar', 'Forms'],
  'form-submissions': ['Form gönderimi', 'Form submission', 'Form gönderimleri', 'Form submissions'],
  search: ['Arama kaydı', 'Search entry', 'Arama dizini', 'Search index'],
}

export const GLOBAL_LABELS: Record<string, Localized> = {
  header: loc('Üst menü', 'Header'),
  footer: loc('Alt bilgi', 'Footer'),
  'site-settings': loc('Site ayarları', 'Site settings'),
}

/** Tab labels keyed by the original English label. */
const TABS: Record<string, Entry> = {
  Content: ['İçerik', 'Content'],
  Overview: ['Genel bakış', 'Overview'],
  Features: ['Özellikler', 'Features'],
  Technical: ['Teknik', 'Technical'],
  Media: ['Medya', 'Media'],
  Related: ['İlişkili kayıtlar', 'Related'],
  General: ['Genel', 'General'],
  'Company & Contact': ['Şirket ve iletişim', 'Company & contact'],
  Legal: ['Hukuki', 'Legal', 'Hukuki metin sayfaları (pageType = Hukuki olan sayfalar).', 'Legal text pages (pages with pageType = Legal).'],
  Requests: ['Talepler', 'Requests'],
}

/** Array row labels keyed by field name. */
const ROWS: Record<string, RowEntry> = {
  features: ['Özellik', 'Feature', 'Özellikler', 'Features'],
  specs: ['Teknik özellik', 'Spec', 'Teknik özellikler', 'Specs'],
  systemRequirements: ['Sistem gereksinimi', 'Requirement', 'Sistem gereksinimleri', 'Requirements'],
  highlights: ['Madde', 'Highlight', 'Öne çıkan maddeler', 'Highlights'],
  results: ['Sonuç', 'Result', 'Sonuçlar', 'Results'],
  changes: ['Değişiklik', 'Change', 'Değişiklikler', 'Changes'],
  social: ['Sosyal bağlantı', 'Social link', 'Sosyal bağlantılar', 'Social links'],
  navItems: ['Menü öğesi', 'Menu item', 'Menü öğeleri', 'Menu items'],
  children: ['Alt bağlantı', 'Child link', 'Alt bağlantılar', 'Child links'],
  columns: ['Kolon', 'Column', 'Kolonlar', 'Columns'],
  links: ['Bağlantı', 'Link', 'Bağlantılar', 'Links'],
  legalLinks: ['Yasal bağlantı', 'Legal link', 'Yasal bağlantılar', 'Legal links'],
  actions: ['Buton', 'Action', 'Butonlar', 'Actions'],
}

const SLUG_DESC: Entry = [
  'Slug (sayfa adresi)',
  'Slug',
  'Sayfa adresinin parçası. Boş bırakılırsa başlıktan üretilir; yalnız küçük harf, rakam ve tire.',
  'Part of the page address. Generated from the title when empty; lowercase letters, digits and hyphens only.',
]

const GENERIC: Record<string, Entry> = {
  // shared
  title: ['Başlık', 'Title'],
  name: ['Ad', 'Name'],
  tagline: ['Slogan', 'Tagline', 'Başlığın altında görünen kısa cümle.', 'Short line shown below the title.'],
  summary: ['Özet', 'Summary', 'Liste kartlarında ve arama sonuçlarında görünen kısa metin.', 'Short text shown on list cards and in search results.'],
  description: ['Açıklama', 'Description'],
  icon: ['İkon', 'Icon', 'Lucide ikon adı (ör. package, shield).', 'Lucide icon name (e.g. package, shield).'],
  image: ['Görsel', 'Image'],
  slug: SLUG_DESC,
  sortOrder: ['Sıra', 'Sort order', 'Küçük sayı listede önce görünür.', 'Lower numbers appear first in lists.'],
  publishedAt: ['Yayın tarihi', 'Published at', 'İlk yayında otomatik doldurulur; değiştirilebilir.', 'Filled automatically on first publish; editable.'],
  featured: ['Öne çıkan', 'Featured', 'Ana sayfa ve listelerde öne çıkarır.', 'Highlights this item on the home page and in lists.'],
  layout: ['Sayfa blokları', 'Page blocks', 'Sayfa içeriğini oluşturan bloklar; sürükleyerek sıralayın.', 'Blocks that make up the page content; drag to reorder.'],
  product: ['Ürün', 'Product'],
  products: ['Ürünler', 'Products'],
  industry: ['Sektör', 'Industry'],
  industries: ['Sektörler', 'Industries'],
  email: ['E-posta', 'Email'],
  phone: ['Telefon', 'Phone'],
  notes: ['Notlar', 'Notes', 'Yalnız personel görür.', 'Visible to staff only.'],
  text: ['Metin', 'Text'],
  url: ['Adres (URL)', 'URL'],
  label: ['Etiket', 'Label'],
  value: ['Değer', 'Value'],
  type: ['Tür', 'Type'],
  status: ['Durum', 'Status'],
  seats: ['Koltuk sayısı', 'Seats'],
  category: ['Kategori', 'Category'],
  link: ['Bağlantı', 'Link'],
  secondary: ['İkincil bağlantı', 'Secondary link'],
  logo: ['Logo', 'Logo'],
  author: ['Yazar', 'Author'],
  content: ['İçerik', 'Content'],
  excerpt: ['Kısa özet', 'Excerpt', 'Listelerde ve arama sonuçlarında görünür.', 'Shown in lists and search results.'],
  coverImage: ['Kapak görseli', 'Cover image'],
  heroImage: ['Kapak görseli', 'Hero image', 'Sayfanın üstünde ve liste kartlarında kullanılır.', 'Used at the top of the page and on list cards.'],
  // users / customers
  enableAPIKey: ['API anahtarını etkinleştir', 'Enable API key', 'Yalnız MCP/entegrasyon için; yalnız yöneticiler kullanabilir.', 'For MCP/integrations only; administrators only.'],
  apiKey: ['API anahtarı', 'API key', 'Gizli tutun; repoya yazmayın.', 'Keep it secret; never commit it.'],
  roles: ['Roller', 'Roles', 'Yönetici: tam erişim. Editör: içerik yönetimi.', 'Admin: full access. Editor: content management.'],
  _verified: ['E-posta doğrulandı', 'Email verified'],
  company: ['Şirket', 'Company'],
  taxNumber: ['Vergi no / TCKN', 'Tax no / national ID'],
  taxOffice: ['Vergi dairesi', 'Tax office'],
  preferredLocale: ['Tercih edilen dil', 'Preferred language', 'Müşteriye giden e-postaların dili.', 'Language of emails sent to the customer.'],
  marketingConsent: ['Pazarlama izni', 'Marketing consent'],
  kvkkConsentAt: ['KVKK onay tarihi', 'KVKK consent date'],
  kvkkConsentVersion: ['KVKK metin sürümü', 'KVKK text version'],
  // catalog
  family: ['Ürün ailesi', 'Product family'],
  features: ['Özellikler', 'Features'],
  specs: ['Teknik özellikler', 'Specs'],
  group: ['Grup', 'Group'],
  systemRequirements: ['Sistem gereksinimleri', 'System requirements'],
  os: ['İşletim sistemi', 'Operating system'],
  minimum: ['Minimum', 'Minimum'],
  recommended: ['Önerilen', 'Recommended'],
  gallery: ['Galeri', 'Gallery'],
  brochure: ['Broşür', 'Brochure', 'Ürün broşürü (PDF).', 'Product brochure (PDF).'],
  editions: ['Lisans sürümleri', 'Editions'],
  releases: ['Sürüm notları', 'Releases'],
  downloads: ['İndirmeler', 'Downloads'],
  docs: ['Dokümanlar', 'Docs'],
  sku: ['SKU', 'SKU', 'Teklif ve lisans atamasında kullanılan sabit kimlik (ör. ERP-PRO-1Y). Sonradan değiştirmeyin.', 'Stable identifier used in quotes and license assignment (e.g. ERP-PRO-1Y). Do not change later.'],
  highlights: ['Öne çıkan maddeler', 'Highlights'],
  licenseType: ['Lisans türü', 'License type'],
  durationMonths: ['Süre (ay)', 'Duration (months)', 'Abonelik süresi. Kalıcı lisansta boş bırakın.', 'Subscription length. Leave empty for perpetual licenses.'],
  // marketing
  caseStudies: ['Referanslar', 'Case studies'],
  customerName: ['Müşteri adı', 'Customer name'],
  customerLogo: ['Müşteri logosu', 'Customer logo'],
  challenge: ['Zorluk', 'Challenge'],
  solution: ['Çözüm', 'Solution'],
  results: ['Sonuçlar', 'Results', 'Rakamlarla kısa sonuçlar (ör. %40, hızlanma).', 'Short results with numbers (e.g. 40%, faster).'],
  testimonial: ['Müşteri yorumu', 'Testimonial'],
  quote: ['Alıntı', 'Quote'],
  role: ['Unvan', 'Role'],
  department: ['Departman', 'Department'],
  location: ['Lokasyon', 'Location'],
  employmentType: ['Çalışma türü', 'Employment type'],
  workMode: ['Çalışma şekli', 'Work mode'],
  applicationForm: ['Başvuru formu', 'Application form', 'Başvurularda kullanılan form (Formlar koleksiyonu).', 'Form used for applications (Forms collection).'],
  isOpen: ['Başvuruya açık', 'Open for applications', 'Kapalıysa ilan sitede listelenmez.', 'When off, the opening is not listed on the site.'],
  website: ['Web sitesi', 'Website'],
  tier: ['Seviye', 'Tier'],
  country: ['Ülke', 'Country'],
  city: ['Şehir', 'City'],
  pageType: ['Sayfa türü', 'Page type'],
  // media
  seedPath: ['İçe aktarma yolu', 'Import path', 'content:import tarafından yönetilir; elle değiştirmeyin.', 'Managed by content:import; do not edit by hand.'],
  alt: ['Alternatif metin', 'Alt text', 'Görseli anlatan kısa metin (erişilebilirlik ve SEO için zorunlu).', 'Short description of the image (required for accessibility and SEO).'],
  caption: ['Alt yazı', 'Caption'],
  protected: ['Korumalı dosya', 'Protected file', 'İndirme dosyaları için gerekli. Etkinleştirildikten sonra geri alınamaz; herkese açık içerik görsellerinde yükleme sırasında kapalı bırakın.', 'Required for downloads. Permanent once enabled; leave off at upload for public content images.'],
  visibility: ['Görünürlük', 'Visibility'],
  licensedProducts: ['Lisanslı ürünler', 'Licensed products', 'Bu ürünlerden birine geçerli lisansı olan müşteriler dosyaya erişir.', 'Customers with a valid license for any of these products can access the file.'],
  // support
  parent: ['Üst doküman', 'Parent doc', 'İç içe gezinme için isteğe bağlı üst doküman.', 'Optional parent for nested navigation.'],
  appliesToVersions: ['Geçerli sürümler', 'Applies to versions', 'Ör. ">=3.0".', 'E.g. ">=3.0".'],
  version: ['Sürüm numarası', 'Version', 'Anlamsal sürüm, ör. 3.2.1.', 'Semantic version, e.g. 3.2.1.'],
  channel: ['Kanal', 'Channel'],
  releaseDate: ['Yayın tarihi', 'Release date'],
  changes: ['Değişiklikler', 'Changes'],
  file: ['Dosya', 'File'],
  release: ['Sürüm', 'Release'],
  arch: ['Mimari', 'Architecture'],
  access: ['Erişim', 'Access', 'Lisanslı: yalnız geçerli lisansı olan müşteriler indirebilir.', 'Licensed: only customers with a valid license can download.'],
  checksumSha256: ['SHA-256 özeti', 'SHA-256 checksum', 'Dosya bütünlüğünü doğrulamak için.', 'Lets users verify file integrity.'],
  question: ['Soru', 'Question'],
  answer: ['Cevap', 'Answer'],
  subject: ['Konu', 'Subject'],
  customer: ['Müşteri', 'Customer'],
  priority: ['Öncelik', 'Priority'],
  messages: ['Mesajlar', 'Messages'],
  lastMessageAt: ['Son mesaj tarihi', 'Last message at'],
  ticket: ['Destek talebi', 'Ticket'],
  staffUser: ['Personel', 'Staff user'],
  body: ['Mesaj', 'Message'],
  // licenses
  key: ['Lisans anahtarı', 'License key', 'Otomatik üretilir (CSPRNG). Biçim XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.', 'Generated automatically (CSPRNG). Format XXXXX-XXXXX-XXXXX-XXXXX-XXXXX.'],
  edition: ['Lisans sürümü', 'Edition', 'Ürün ve koltuk sayısı bu sürümden alınır.', 'Product and seat count are taken from this edition.'],
  startsAt: ['Başlangıç', 'Starts at'],
  expiresAt: ['Bitiş', 'Expires at', 'Boşsa lisans süresizdir.', 'Empty means the license does not expire.'],
  // globals
  siteName: ['Site adı', 'Site name', 'Başlıkta, e-postalarda ve footer telifinde kullanılır.', 'Used in titles, emails and the footer copyright.'],
  defaultOgImage: ['Varsayılan paylaşım görseli', 'Default share image', 'Sosyal paylaşımlarda görseli olmayan sayfalar için (herkese açık medya).', 'Used when a page has no share image (public media).'],
  brand: ['Marka', 'Brand'],
  legalName: ['Ticari unvan', 'Legal name'],
  mersisNo: ['MERSİS no', 'MERSIS no'],
  kepAddress: ['KEP adresi', 'KEP address'],
  contact: ['İletişim', 'Contact'],
  salesEmail: ['Satış e-postası', 'Sales email'],
  supportEmail: ['Destek e-postası', 'Support email'],
  address: ['Adres', 'Address'],
  mapUrl: ['Harita bağlantısı', 'Map URL'],
  workingHours: ['Çalışma saatleri', 'Working hours'],
  platform: ['Platform', 'Platform'],
  legal: ['Hukuki sayfalar', 'Legal pages', 'Footer ve formlarda bağlanan hukuki metin sayfaları.', 'Legal text pages linked from the footer and forms.'],
  kvkk: ['KVKK aydınlatma metni', 'KVKK notice'],
  privacy: ['Gizlilik politikası', 'Privacy policy'],
  cookies: ['Çerez politikası', 'Cookie policy'],
  terms: ['Kullanım koşulları', 'Terms of use'],
  eula: ['Lisans sözleşmesi (EULA)', 'License agreement (EULA)'],
  commerce: ['Teklif ve talepler', 'Quotes & requests'],
  quoteForm: ['Teklif formu', 'Quote form', 'Tüm sürümlerdeki "Teklif İste" için kullanılan form.', 'Form used by "Request a quote" on every edition.'],
  demoForm: ['Demo formu', 'Demo form', '"Demo Talep" sayfasında kullanılan form.', 'Form used on the demo request page.'],
  columns: ['Kolonlar', 'Columns'],
  links: ['Bağlantılar', 'Links'],
  legalLinks: ['Yasal bağlantılar', 'Legal links', 'Footer alt çubuğunda görünür.', 'Shown in the footer bottom bar.'],
  copyright: ['Telif metni', 'Copyright text', '{year} ve {siteName} yer tutucuları desteklenir. Boşsa "© {year} {siteName}. Tüm hakları saklıdır." kullanılır.', 'Supports {year} and {siteName} placeholders. Empty uses "© {year} {siteName}. All rights reserved."'],
  showNewsletter: ['Bülten formunu göster', 'Show newsletter form'],
  newsletterForm: ['Bülten formu', 'Newsletter form'],
  children: ['Alt bağlantılar', 'Child links'],
  actions: ['Butonlar', 'Actions'],
  social: ['Sosyal bağlantılar', 'Social links'],
  navItems: ['Menü öğeleri', 'Menu items'],
  enabled: ['Göster', 'Show'],
}

/** Collection/path specific overrides (`<slug>:<path or name>`). */
const SPECIFIC: Record<string, Entry> = {
  'users:name': ['Ad soyad', 'Full name'],
  'customers:name': ['Ad soyad', 'Full name'],
  'customers:notes': ['Dahili notlar', 'Internal notes', 'Yalnız personel görür; müşteri görmez.', 'Visible to staff only, never to the customer.'],
  'customers:taxNumber': ['Vergi no / TCKN', 'Tax no / national ID'],
  'pages:slug': ['Slug (sayfa adresi)', 'Slug', 'Ana sayfa için "home" kullanın. Boşsa başlıktan üretilir.', 'Use "home" for the home page. Generated from the title when empty.'],
  'pages:pageType': ['Sayfa türü', 'Page type', 'Standart/Landing: /<slug> adresinde yayınlanır. Şablon: sitede görünmez; "Çoğalt" ile yeni sayfa başlatın.', 'Standard/Landing: published at /<slug>. Template: never public; use "Duplicate" to start a new page.'],
  'pages:title': ['Sayfa başlığı', 'Page title', 'Tarayıcı sekmesinde ve admin listesinde görünür.', 'Shown in the browser tab and admin lists.'],
  'products:title': ['Ürün adı', 'Product name'],
  'products:summary': ['Özet', 'Summary', 'Katalog kartlarında ve arama sonuçlarında görünür.', 'Shown on catalog cards and in search results.'],
  'products:publishedAt': ['Yayın tarihi', 'Published at', 'İlk yayında otomatik doldurulur.', 'Filled automatically on first publish.'],
  'products:features.title': ['Başlık', 'Title'],
  'products:specs.group': ['Grup', 'Group', 'Tabloda satırları gruplar (ör. Performans).', 'Groups rows in the table (e.g. Performance).'],
  'products:specs.label': ['Özellik', 'Property'],
  'product-families:products': ['Ürünler', 'Products', 'Bu aileye bağlı ürünler (ürün kaydından seçilir).', 'Products in this family (chosen on the product record).'],
  'product-families:image': ['Görsel', 'Image', 'Aile sayfasında ve kartlarda kullanılır.', 'Used on the family page and cards.'],
  'editions:title': ['Sürüm adı', 'Edition name', 'Teklif formunda ve lisanslarda görünür (ör. Pro - 1 Yıl).', 'Shown in quote forms and licenses (e.g. Pro - 1 year).'],
  'editions:description': ['Açıklama', 'Description', 'Sürüm kartında görünen kısa metin.', 'Short text shown on the edition card.'],
  'editions:highlights.text': ['Madde', 'Item'],
  'editions:seats': ['Koltuk sayısı', 'Seats', 'Lisansa dahil kullanıcı/cihaz sayısı.', 'Number of users/devices included.'],
  'case-studies:title': ['Referans başlığı', 'Case study title'],
  'case-studies:results.label': ['Etiket', 'Label'],
  'case-studies:testimonial.author': ['Kişi', 'Person'],
  'case-studies:solution': ['Çözüm', 'Solution', 'Uygulanan çözümün anlatımı.', 'How the solution was applied.'],
  'posts:author': ['Yazar', 'Author', 'Yazıyı yayınlayan personel (users).', 'Staff user who published the post.'],
  'posts:products': ['İlgili ürünler', 'Related products'],
  'posts:content': ['İçerik', 'Content'],
  'posts:category': ['Kategori', 'Category', 'Haber listesindeki filtre.', 'Filter in the news list.'],
  'solutions:products': ['İlgili ürünler', 'Related products'],
  'solutions:industries': ['İlgili sektörler', 'Related industries'],
  'solutions:caseStudies': ['İlgili referanslar', 'Related case studies'],
  'case-studies:products': ['İlgili ürünler', 'Related products'],
  'case-studies:industry': ['Sektör', 'Industry'],
  'products:industries': ['Sektörler', 'Industries'],
  'products:releases': ['Sürüm notları', 'Releases', 'Bu ürünün sürüm notları (sürüm kaydından bağlanır).', 'Release notes of this product (linked from the release record).'],
  'products:editions': ['Lisans sürümleri', 'Editions', 'Bu ürünün sürümleri (sürüm kaydından bağlanır).', 'Editions of this product (linked from the edition record).'],
  'products:downloads': ['İndirmeler', 'Downloads', 'Bu ürünün indirme dosyaları.', 'Download files of this product.'],
  'products:docs': ['Dokümanlar', 'Docs', 'Bu ürünün dokümanları.', 'Docs of this product.'],
  'releases:title': ['Başlık', 'Title', 'İsteğe bağlı sürüm başlığı (ör. "Yeni arayüz").', 'Optional release headline (e.g. "New interface").'],
  'releases:notes': ['Sürüm notları', 'Release notes'],
  'releases:downloads': ['İndirmeler', 'Downloads', 'Bu sürüme bağlı dosyalar (indirme kaydından bağlanır).', 'Files attached to this release (linked from the download record).'],
  'releases:changes.description': ['Açıklama', 'Description'],
  'releases:changes.type': ['Değişiklik türü', 'Change type'],
  'downloads:title': ['Dosya adı', 'File title'],
  'downloads:file': ['Dosya', 'File', 'Medya kaydı; erişim düzeyi buradan eşitlenir.', 'Media record; its access level is synced from here.'],
  'downloads:release': ['Sürüm', 'Release'],
  'docs:product': ['Ürün', 'Product', 'Slug bu ürün ve dil içinde benzersizdir.', 'The slug is unique within this product and language.'],
  'docs:content': ['İçerik', 'Content'],
  'faqs:slug': ['Slug (sayfa adresi)', 'Slug', 'Boş bırakılırsa sorudan üretilir.', 'Generated from the question when empty.'],
  'faqs:category': ['Kategori', 'Category', 'SSS sayfasındaki filtre.', 'Filter on the FAQ page.'],
  'partners:name': ['İş ortağı adı', 'Partner name'],
  'partners:description': ['Açıklama', 'Description', 'İş ortakları sayfasında kartta görünür.', 'Shown on the partner card.'],
  'support-tickets:status': ['Durum', 'Status'],
  'support-tickets:product': ['Ürün', 'Product'],
  'support-tickets:messages': ['Mesajlar', 'Messages', 'Müşteri yalnızca yeni mesaj ekleyebilir.', 'Customers can only append new messages.'],
  'support-ticket-messages:author': ['Gönderen', 'Sender'],
  'licenses:customer': ['Müşteri', 'Customer'],
  'licenses:product': ['Ürün', 'Product', 'Lisans sürümünden türetilir.', 'Derived from the edition.'],
  'licenses:seats': ['Koltuk sayısı', 'Seats', 'Lisans sürümünden alınır.', 'Taken from the edition.'],
  'licenses:notes': ['Notlar', 'Notes', 'Yalnız yönetici görür.', 'Visible to administrators only.'],
  'site-settings:logo': ['Logo', 'Logo', 'Açık zeminler için (herkese açık medya). Boşsa varsayılan işaret ve site adı.', 'For light backgrounds (public media). Empty uses the default mark and site name.'],
  'site-settings:logoDark': ['Logo (koyu zemin)', 'Logo (dark background)', 'Koyu zeminler için (üst menü/alt bilgi). Boşsa "Logo" kullanılır.', 'For dark backgrounds (header/footer). Empty uses "Logo".'],
  'site-settings:favicon': ['Favicon', 'Favicon', 'Kare PNG/SVG/ICO (herkese açık). Boşsa varsayılan simge.', 'Square PNG/SVG/ICO (public). Empty uses the default icon.'],
  'site-settings:tagline': ['Slogan', 'Tagline', 'Footer ve paylaşım metinlerinde kullanılır.', 'Used in the footer and share texts.'],
  'site-settings:contact.email': ['Genel e-posta', 'General email'],
  'site-settings:company.taxOffice': ['Vergi dairesi', 'Tax office'],
  'site-settings:company.taxNumber': ['Vergi numarası', 'Tax number'],
  'site-settings:social.url': ['Profil adresi', 'Profile URL'],
  'footer:columns.title': ['Kolon başlığı', 'Column title'],
  'footer:columns.links': ['Bağlantılar', 'Links'],
  'footer:columns': ['Kolonlar', 'Columns', 'Footer\'daki bağlantı kolonları.', 'Link columns in the footer.'],
  'header:children.description': ['Açıklama', 'Description', 'Açılır menüde bağlantının altında görünen kısa metin.', 'Short text under the link in the dropdown.'],
  'header:navItems': ['Menü öğeleri', 'Menu items', 'Sürükleyerek sıralayın.', 'Drag to reorder.'],
  'header:columns.title': ['Kolon başlığı', 'Column title'],
  'header:columns.links': ['Bağlantılar', 'Links'],
  'header:columns.description': ['Açıklama', 'Description'],
  'header:children': ['Alt bağlantılar', 'Child links'],
  'header:columns': ['Mega menü kolonları', 'Mega menu columns'],
  'header:featured.link': ['Bağlantı', 'Link'],
  'header:announcement.link': ['Bağlantı', 'Link'],
}

/** Select option labels: `<slug>:<name>=<value>` or `*:<name>=<value>`. */
const OPTIONS: Record<string, readonly [string, string]> = {
  'roles=admin': ['Yönetici', 'Administrator'],
  'roles=editor': ['Editör', 'Editor'],
  'preferredLocale=tr': ['Türkçe', 'Türkçe'],
  'preferredLocale=en': ['English', 'English'],
  'os=windows': ['Windows', 'Windows'],
  'os=macos': ['macOS', 'macOS'],
  'os=linux': ['Linux', 'Linux'],
  'os=web': ['Web / SaaS', 'Web / SaaS'],
  'os=android': ['Android', 'Android'],
  'os=ios': ['iOS', 'iOS'],
  'os=other': ['Diğer', 'Other'],
  'licenseType=perpetual': ['Kalıcı', 'Perpetual'],
  'licenseType=subscription': ['Abonelik', 'Subscription'],
  'category=news': ['Haber', 'News'],
  'category=product-update': ['Ürün güncellemesi', 'Product update'],
  'category=event': ['Etkinlik', 'Event'],
  'category=blog': ['Blog', 'Blog'],
  'category=general': ['Genel', 'General'],
  'category=licensing': ['Lisanslama', 'Licensing'],
  'category=billing': ['Faturalama', 'Billing'],
  'category=technical': ['Teknik', 'Technical'],
  'employmentType=full-time': ['Tam zamanlı', 'Full-time'],
  'employmentType=part-time': ['Yarı zamanlı', 'Part-time'],
  'employmentType=contract': ['Sözleşmeli', 'Contract'],
  'employmentType=internship': ['Staj', 'Internship'],
  'workMode=onsite': ['Ofiste', 'On-site'],
  'workMode=hybrid': ['Hibrit', 'Hybrid'],
  'workMode=remote': ['Uzaktan', 'Remote'],
  'tier=technology': ['Teknoloji', 'Technology'],
  'tier=solution': ['Çözüm', 'Solution'],
  'tier=reseller': ['Bayi', 'Reseller'],
  'tier=distributor': ['Distribütör', 'Distributor'],
  'pageType=standard': ['Standart', 'Standard'],
  'pageType=legal': ['Hukuki', 'Legal'],
  'pageType=landing': ['Landing sayfası', 'Landing'],
  'visibility=public': ['Herkese açık', 'Public'],
  'visibility=licensed': ['Yalnız lisanslı müşteriler', 'Licensed customers only'],
  'channel=stable': ['Kararlı', 'Stable'],
  'channel=beta': ['Beta', 'Beta'],
  'channel=lts': ['LTS (uzun destek)', 'LTS (long-term support)'],
  'type=new': ['Yeni', 'New'],
  'type=improved': ['İyileştirme', 'Improved'],
  'type=fixed': ['Düzeltme', 'Fixed'],
  'type=security': ['Güvenlik', 'Security'],
  'type=breaking': ['Uyumsuz değişiklik', 'Breaking change'],
  'arch=x64': ['x64', 'x64'],
  'arch=arm64': ['arm64', 'arm64'],
  'arch=x86': ['x86', 'x86'],
  'arch=universal': ['Evrensel', 'Universal'],
  'access=public': ['Herkese açık', 'Public'],
  'access=licensed': ['Lisanslı müşteriler', 'Licensed customers'],
  'status=open': ['Açık', 'Open'],
  'status=pending': ['Müşteri bekleniyor', 'Waiting for customer'],
  'status=resolved': ['Çözüldü', 'Resolved'],
  'status=closed': ['Kapalı', 'Closed'],
  'status=active': ['Aktif', 'Active'],
  'status=suspended': ['Askıda', 'Suspended'],
  'status=revoked': ['İptal edildi', 'Revoked'],
  'status=expired': ['Süresi doldu', 'Expired'],
  'priority=low': ['Düşük', 'Low'],
  'priority=normal': ['Normal', 'Normal'],
  'priority=high': ['Yüksek', 'High'],
  'priority=urgent': ['Acil', 'Urgent'],
  'author=customer': ['Müşteri', 'Customer'],
  'author=staff': ['Personel', 'Staff'],
  'platform=linkedin': ['LinkedIn', 'LinkedIn'],
  'platform=x': ['X', 'X'],
  'platform=youtube': ['YouTube', 'YouTube'],
  'platform=instagram': ['Instagram', 'Instagram'],
  'platform=facebook': ['Facebook', 'Facebook'],
  'platform=github': ['GitHub', 'GitHub'],
}

const isLoc = (v: unknown): v is Localized =>
  !!v && typeof v === 'object' && typeof (v as Localized).tr === 'string' && typeof (v as Localized).en === 'string'

function lookup(slug: string, path: string[]): Entry | undefined {
  const dotted = path.join('.')
  const name = path[path.length - 1]
  return SPECIFIC[`${slug}:${dotted}`] ?? SPECIFIC[`${slug}:${name}`] ?? GENERIC[name]
}

type AnyField = Record<string, unknown> & { type: string; name?: string; fields?: AnyField[]; blocks?: AnyBlock[]; tabs?: AnyTab[]; options?: unknown[] }
type AnyBlock = Record<string, unknown> & { slug: string; fields: AnyField[] }
type AnyTab = Record<string, unknown> & { name?: string; label?: unknown; description?: unknown; fields: AnyField[] }

function localizeFields(slug: string, fields: AnyField[], path: string[]): AnyField[] {
  return fields.map((raw) => {
    const f: AnyField = { ...raw }
    if (f.type === 'tabs' && f.tabs) {
      f.tabs = f.tabs.map((raw): AnyTab => {
        const tab = { ...raw }
        const key = typeof tab.label === 'string' ? tab.label : tab.name
        const entry = key ? TABS[key] : undefined
        if (entry && !isLoc(tab.label)) tab.label = loc(entry[0], entry[1])
        if (entry?.[2] && !isLoc(tab.description)) tab.description = loc(entry[2], entry[3] ?? entry[2])
        tab.fields = localizeFields(slug, tab.fields, path)
        return tab
      })
      return f
    }
    if (!f.name) {
      if (f.fields) f.fields = localizeFields(slug, f.fields, path)
      return f
    }
    const here = [...path, f.name]
    const entry = lookup(slug, here)
    if (entry && f.label !== false && !isLoc(f.label)) f.label = loc(entry[0], entry[1])
    if (entry?.[2]) {
      const admin = { ...(f.admin as Record<string, unknown> | undefined) }
      if (!isLoc(admin.description)) {
        admin.description = loc(entry[2], entry[3] ?? entry[2])
        f.admin = admin
      }
    }
    const row = ROWS[f.name]
    if (f.type === 'array' && row) {
      const labels = f.labels as { singular?: unknown; plural?: unknown } | undefined
      if (!isLoc(labels?.singular) || !isLoc(labels?.plural)) {
        f.labels = { singular: loc(row[0], row[1]), plural: loc(row[2], row[3]) }
      }
    }
    if (Array.isArray(f.options)) {
      f.options = f.options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : { ...(o as { value: string; label: unknown }) }
        if (!isLoc(opt.label)) {
          const hit = OPTIONS[`${f.name}=${opt.value}`]
          if (hit) opt.label = loc(hit[0], hit[1])
        }
        return opt
      })
    }
    if (f.fields) f.fields = localizeFields(slug, f.fields, here)
    if (f.blocks) {
      f.blocks = f.blocks.map((b) => ({ ...b, fields: localizeFields(slug, b.fields, [...here, b.slug]) }))
    }
    return f
  })
}

export function localizeGroup(group: unknown): unknown {
  if (typeof group === 'string') return GROUP_BY_LEGACY[group] ?? group
  return group
}

export function localizeCollection<T extends CollectionConfig>(collection: T): T {
  const labels = COLLECTION_LABELS[collection.slug]
  return {
    ...collection,
    ...(labels ? { labels: { singular: loc(labels[0], labels[1]), plural: loc(labels[2], labels[3]) } } : {}),
    admin: { ...collection.admin, group: localizeGroup(collection.admin?.group) as never },
    fields: localizeFields(collection.slug, collection.fields as unknown as AnyField[], []) as unknown as Field[],
  }
}

export function localizeGlobal<T extends GlobalConfig>(global: T): T {
  const label = GLOBAL_LABELS[global.slug]
  return {
    ...global,
    ...(label ? { label } : {}),
    admin: { ...global.admin, group: localizeGroup(global.admin?.group) as never },
    fields: localizeFields(global.slug, global.fields as unknown as AnyField[], []) as unknown as Field[],
  }
}
