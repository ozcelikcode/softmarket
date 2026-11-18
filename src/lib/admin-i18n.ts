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
  sales: loc('Satış', 'Sales'),
  site: loc('Site', 'Site'),
  forms: loc('Formlar', 'Forms'),
  security: loc('Güvenlik', 'Security'),
} as const

const GROUP_BY_LEGACY: Record<string, Localized> = {
  Admin: ADMIN_GROUPS.admin,
  Customers: ADMIN_GROUPS.customers,
  Catalog: ADMIN_GROUPS.catalog,
  Marketing: ADMIN_GROUPS.marketing,
  Content: ADMIN_GROUPS.content,
  Support: ADMIN_GROUPS.support,
  Licenses: ADMIN_GROUPS.licenses,
  Sales: ADMIN_GROUPS.sales,
  Site: ADMIN_GROUPS.site,
  Forms: ADMIN_GROUPS.forms,
  Security: ADMIN_GROUPS.security,
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
  orders: ['Sipariş', 'Order', 'Siparişler', 'Orders'],
  'payment-events': ['Ödeme bildirimi', 'Payment event', 'Ödeme bildirimleri', 'Payment events'],
  // Licensing core (L1)
  'license-activations': ['Cihaz aktivasyonu', 'Device activation', 'Cihaz aktivasyonları', 'Device activations'],
  'license-status-log': ['Lisans durum kaydı', 'License status entry', 'Lisans durum günlüğü', 'License status log'],
  'security-events': ['Güvenlik olayı', 'Security event', 'Güvenlik olayları', 'Security events'],
  'security-blocks': ['Engel', 'Block', 'Engel listesi', 'Block list'],
  'security-audit': ['Denetim kaydı', 'Audit entry', 'Güvenlik denetim izi', 'Security audit trail'],
  // Plugin collections (labels set through plugin overrides in payload.config).
  forms: ['Form', 'Form', 'Formlar', 'Forms'],
  'form-submissions': ['Form gönderimi', 'Form submission', 'Form gönderimleri', 'Form submissions'],
  search: ['Arama kaydı', 'Search entry', 'Arama dizini', 'Search index'],
}

export const GLOBAL_LABELS: Record<string, Localized> = {
  header: loc('Üst menü', 'Header'),
  footer: loc('Alt bilgi', 'Footer'),
  'site-settings': loc('Site ayarları', 'Site settings'),
  integrations: loc('Entegrasyon ayarları', 'Integration settings'),
  'licensing-settings': loc('Lisanslama ve güvenlik ayarları', 'Licensing & security settings'),
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
  // licensing-settings (L1)
  Limits: ['Limitler', 'Limits', 'Lisanslama API\'si istek sınırları (süreç içi sayaçlar).', 'Request limits of the licensing API (in-process counters).'],
  Rules: ['Kurallar', 'Rules', 'Otomatik kurallar en fazla askıya alır; iptal her zaman yönetici onayı ister.', 'Automatic rules can at most suspend; revoking always needs an administrator.'],
  'Self-service': ['Self-servis', 'Self-service'],
  Notifications: ['Bildirimler', 'Notifications'],
  Retention: ['Saklama süreleri', 'Retention', 'Kişisel veri saklama süreleri (KVKK). Alt sınırların altına inilemez.', 'Personal data retention periods (KVKK). Cannot go below the built-in minimums.'],
  'Signing keys': ['İmza anahtarları', 'Signing keys', 'Yalnız açık anahtarlar listelenir; gizli anahtar burada saklanmaz ve hiçbir yerde gösterilmez.', 'Only public keys are listed; the private key is never stored here nor shown anywhere.'],
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
  layout: ['Blok', 'Block', 'Bloklar', 'Blocks'],
  alertEmails: ['Uyarı adresi', 'Alert address', 'Uyarı adresleri', 'Alert addresses'],
  signingKeys: ['İmza anahtarı', 'Signing key', 'İmza anahtarları', 'Signing keys'],
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

/** L1 licensing core: field labels shared by the five security collections (applied per slug below). */
const SECURITY_COLLECTIONS = ['license-activations', 'license-status-log', 'security-events', 'security-blocks', 'security-audit'] as const
const SECURITY_FIELDS: Record<string, Entry> = {
  publicId: ['Genel kimlik', 'Public ID', 'API\'de kullanılan rastgele kimlik; sıralı kayıt numarası dışarı verilmez.', 'Random ID used by the API; the sequential record number is never exposed.'],
  license: ['Lisans', 'License'],
  activation: ['Cihaz aktivasyonu', 'Device activation'],
  order: ['Sipariş', 'Order'],
  actorUser: ['İşlemi yapan', 'Acting user'],
  endReason: ['Bitiş nedeni', 'End reason'],
  devicePublicKey: ['Cihaz açık anahtarı', 'Device public key', 'Ed25519 açık anahtarı (base64url). Gizli anahtar cihazdan çıkmaz.', 'Ed25519 public key (base64url). The private key never leaves the device.'],
  deviceKeyThumbprint: ['Anahtar parmak izi', 'Key thumbprint', 'Cihaz açık anahtarının SHA-256 özeti.', 'SHA-256 digest of the device public key.'],
  fingerprintHash: ['Cihaz izi özeti', 'Device fingerprint hash', 'Anahtarlı HMAC; ham donanım bilgisi saklanmaz.', 'Keyed HMAC; raw hardware data is never stored.'],
  deviceLabel: ['Cihaz adı', 'Device label', 'Müşteri portalda değiştirebilir (en çok 64 karakter).', 'Editable by the customer in the portal (max 64 characters).'],
  appVersion: ['Uygulama sürümü', 'App version'],
  counter: ['Sayaç', 'Counter', 'Klon tespiti için son verilen dönen sayaç.', 'Last rotating counter issued, used for clone detection.'],
  prevCounter: ['Önceki sayaç', 'Previous counter'],
  activatedAt: ['Aktivasyon zamanı', 'Activated at'],
  lastSeenAt: ['Son görülme', 'Last seen at'],
  endedAt: ['Bitiş zamanı', 'Ended at'],
  lastIpPrefix: ['Son IP öneki', 'Last IP prefix', 'Yalnız kısaltılmış önek (IPv4 /24, IPv6 /48); süre sonunda silinir.', 'Truncated prefix only (IPv4 /24, IPv6 /48); cleared after the retention period.'],
  lastIpHash: ['Son IP özeti', 'Last IP hash', 'Aylık değişen anahtarlı HMAC; tam IP saklanmaz.', 'Keyed HMAC with a monthly key; the full IP is never stored.'],
  lastCountry: ['Son ülke', 'Last country', 'İki harfli ülke kodu (yalnız ülke kaynağı açıksa).', 'Two-letter country code (only when a country source is enabled).'],
  endNonce: ['Kapatma isteği kimliği', 'Deactivation request ID'],
  severity: ['Önem', 'Severity'],
  source: ['Kaynak', 'Source'],
  firstSeenAt: ['İlk görülme', 'First seen at'],
  count: ['Tekrar sayısı', 'Occurrences'],
  dedupeKey: ['Toplama anahtarı', 'Aggregation key', 'Aynı anahtarlı olaylar tek satırda sayılır.', 'Events with the same key are counted in one row.'],
  ipPrefix: ['IP öneki', 'IP prefix', 'Yalnız kısaltılmış önek; süre sonunda silinir.', 'Truncated prefix only; cleared after the retention period.'],
  ipHash: ['IP özeti', 'IP hash', 'Anahtarlı HMAC; tam IP saklanmaz.', 'Keyed HMAC; the full IP is never stored.'],
  detail: ['Ayrıntı', 'Detail', 'Olay türüne göre izinli alanlar; kişisel veri içermez.', 'Allow-listed fields per event type; contains no personal data.'],
  ruleKey: ['Kural', 'Rule'],
  actionTaken: ['Otomatik işlem', 'Automatic action'],
  triage: ['İnceleme durumu', 'Triage'],
  triagedBy: ['İnceleyen', 'Triaged by'],
  triagedAt: ['İnceleme zamanı', 'Triaged at'],
  triageNote: ['İnceleme açıklaması', 'Triage remark'],
  notifyState: ['Bildirim durumu', 'Notification state'],
  notifyAttempts: ['Bildirim denemesi', 'Notification attempts'],
  notifyNextAt: ['Sonraki bildirim denemesi', 'Next notification attempt'],
  notifyLastError: ['Son bildirim hatası', 'Last notification error'],
  kind: ['Engel türü', 'Block kind'],
  value: ['Engellenen değer', 'Blocked value', 'IP için yalnız önek/CIDR; tam IP adresi yazılmaz.', 'For IPs only a prefix/CIDR; never a full IP address.'],
  scope: ['Kapsam', 'Scope'],
  active: ['Etkin', 'Active'],
  expiresAt: ['Bitiş', 'Expires at', 'Boşsa süresizdir (yalnız yönetici ekleyebilir).', 'Empty means permanent (administrators only).'],
  reason: ['Gerekçe', 'Reason'],
  event: ['Güvenlik olayı', 'Security event'],
  createdBy: ['Ekleyen', 'Created by'],
  liftedAt: ['Kaldırılma zamanı', 'Lifted at'],
  liftedBy: ['Kaldıran', 'Lifted by'],
  liftReason: ['Kaldırma gerekçesi', 'Lift reason'],
  from: ['Önceki durum', 'From status'],
  to: ['Yeni durum', 'To status'],
  note: ['Açıklama', 'Remark', 'Kişisel veri (e-posta, IP, lisans anahtarı) yazmayın.', 'Do not enter personal data (e-mail, IP, license key).'],
  at: ['Zaman', 'Time'],
  revertOf: ['Geri alınan kayıt', 'Reverts entry'],
  revertible: ['Geri alınabilir', 'Revertible'],
  action: ['İşlem', 'Action'],
  actorKind: ['İşlemi yapan türü', 'Actor kind'],
  target: ['Hedef kayıt', 'Target record'],
  result: ['Sonuç', 'Result'],
  nonce: ['İstek kimliği', 'Request ID', 'Aynı istek ikinci kez işlenmez.', 'The same request is never processed twice.'],
}

/** L1 licensing-settings field labels (`licensing-settings:<name>`). */
const LICENSING_SETTINGS_FIELDS: Record<string, Entry> = {
  apiEnabled: ['Lisanslama API\'si açık', 'Licensing API enabled', 'Kapalıyken programlara "geçici olarak kullanılamıyor" döner; programlar çevrimdışı toleransla çalışmayı sürdürür.', 'When off, programs get "temporarily unavailable" and keep running within their offline tolerance.'],
  publicHost: ['API alan adı', 'API host name', 'Programlara gömülen alan adı (ör. lisans.ornek.com). Sonradan değiştirmeyin.', 'Host name embedded in programs (e.g. licensing.example.com). Do not change it later.'],
  refreshHours: ['Yenileme aralığı (saat)', 'Refresh interval (hours)', 'Programın kirayı yenilemeye çalıştığı süre.', 'How often a program tries to renew its lease.'],
  leaseDays: ['Çevrimdışı tolerans (gün)', 'Offline tolerance (days)', 'Kira geçerlilik süresi; en çok 30 gün.', 'Lease validity; at most 30 days.'],
  clockSkewSeconds: ['Saat kayması toleransı (sn)', 'Clock skew tolerance (s)'],
  seenWriteMinutes: ['Son görülme yazım aralığı (dk)', 'Last-seen write interval (min)', 'Veritabanı yükünü sınırlar.', 'Limits database writes.'],
  countrySource: ['Ülke kaynağı', 'Country source', 'Yalnız site Cloudflare arkasındaysa Cloudflare ülke başlığını seçin.', 'Choose the Cloudflare country header only when the site is behind Cloudflare.'],
  limits: ['İstek sınırları', 'Request limits'],
  ipPrefixPerMinute: ['IP öneki başına istek / dk', 'Requests per IP prefix / min'],
  invalidLicensePerIpPerHour: ['IP öneki başına geçersiz anahtar / saat', 'Invalid keys per IP prefix / hour', 'Aşılınca IP öneki süreli engellenir.', 'Exceeding it blocks the IP prefix for a while.'],
  ipBlockFirstHours: ['İlk IP engeli (saat)', 'First IP block (hours)'],
  ipBlockRepeatHours: ['Tekrarda IP engeli (saat)', 'Repeat IP block (hours)'],
  activationsPerLicensePerDay: ['Lisans başına aktivasyon / gün', 'Activations per license / day'],
  requestsPerActivationPerHour: ['Aktivasyon başına istek / saat', 'Requests per activation / hour'],
  badSignaturesPerActivationPerHour: ['Aktivasyon başına hatalı imza / saat', 'Bad signatures per activation / hour'],
  globalPerSecond: ['Toplam istek / sn', 'Total requests / s', 'Aşılınca API geçici olarak 503 döner (süreç koruması).', 'Exceeding it makes the API return 503 for a while (process protection).'],
  rules: ['Otomatik kurallar', 'Automatic rules'],
  observeUntil: ['İzleme dönemi bitişi', 'Monitoring period ends', 'Bu tarih geçmeden ve kural "Askıya al" modunda olmadan hiçbir lisans otomatik askıya alınmaz. Boşsa otomatik askı hiç yapılmaz.', 'No license is suspended automatically before this date has passed and the rule is in "Suspend" mode. Empty means never.'],
  maxAutoSuspendsPerHour: ['Saatlik en çok otomatik askı', 'Max automatic suspensions per hour', 'Aşılınca kurallar izlemeye düşer ve kritik olay oluşur (devre kesici).', 'Exceeding it switches rules to monitoring and raises a critical event (circuit breaker).'],
  ipSpread: ['IP dağılımı', 'IP spread', 'Pencere içinde farklı IP öneki sayısı.', 'Distinct IP prefixes within the window.'],
  geoSpread: ['Ülke dağılımı', 'Country spread', 'Ülke kaynağı gerekir.', 'Needs a country source.'],
  impossibleTravel: ['İmkânsız seyahat', 'Impossible travel', 'Ülke kaynağı gerekir.', 'Needs a country source.'],
  activationBurst: ['Aktivasyon patlaması', 'Activation burst'],
  activationChurn: ['Aktivasyon döngüsü', 'Activation churn'],
  cloneSuspected: ['Klon şüphesi tekrarı', 'Repeated clone suspicion'],
  mode: ['Mod', 'Mode', 'İzle: yalnız olay. Bildir: olay ve e-posta. Askıya al: geri alınabilir otomatik askı.', 'Observe: event only. Notify: event and e-mail. Suspend: reversible automatic suspension.'],
  threshold: ['Eşik', 'Threshold'],
  windowHours: ['Pencere (saat)', 'Window (hours)'],
  suppressDays: ['Yanlış alarm sonrası bastırma (gün)', 'Suppression after a false positive (days)'],
  selfService: ['Müşteri işlemleri', 'Customer self-service'],
  portalDeactivationsPer30Days: ['30 günde portaldan cihaz kaldırma', 'Portal device removals per 30 days'],
  rebindsPer30Days: ['30 günde yeniden bağlama', 'Rebinds per 30 days'],
  notifications: ['Bildirim ayarları', 'Notification settings'],
  alertEmails: ['Uyarı adresleri', 'Alert addresses', 'Boşsa ödeme uyarı adresi, o da yoksa site iletişim adresi kullanılır.', 'Empty uses the payments alert address, then the site contact address.'],
  email: ['E-posta', 'Email'],
  minSeverityImmediate: ['Anında e-posta için en düşük önem', 'Minimum severity for immediate e-mail'],
  dailyDigest: ['Günlük özet e-postası', 'Daily digest e-mail'],
  digestHour: ['Özet saati (0-23)', 'Digest hour (0-23)'],
  customerSuspensionEmail: ['Askıda müşteriye e-posta', 'E-mail the customer on suspension'],
  retention: ['Saklama ayarları', 'Retention settings'],
  eventIpDays: ['Olay IP alanları (gün)', 'Event IP fields (days)'],
  eventDays: ['Olay kayıtları (gün)', 'Event records (days)'],
  activationIpDays: ['Aktivasyon IP alanları (gün)', 'Activation IP fields (days)'],
  activationRowYears: ['Sonlanmış aktivasyonlar (yıl)', 'Ended activations (years)', 'Lisans bitişinden sonra.', 'After the license ends.'],
  blockDays: ['Süresi dolmuş engeller (gün)', 'Expired blocks (days)'],
  statusLogYears: ['Durum günlüğü (yıl)', 'Status log (years)', 'Ticari kayıt; en az 10 yıl.', 'Commercial record; at least 10 years.'],
  auditYears: ['Denetim izi (yıl)', 'Audit trail (years)'],
  signingKeys: ['İmza anahtarları', 'Signing keys'],
  kid: ['Anahtar kimliği', 'Key ID'],
  publicKey: ['Açık anahtar', 'Public key'],
  createdAt: ['Oluşturulma', 'Created at'],
  retiredAt: ['Emekliye ayrılma', 'Retired at', 'Yalnız doğrulama için kalır.', 'Kept for verification only.'],
  revokedAt: ['Geçersiz kılınma', 'Revoked at'],
}

/** Collection/path specific overrides (`<slug>:<path or name>`). */
const SPECIFIC: Record<string, Entry> = {
  ...Object.fromEntries(SECURITY_COLLECTIONS.flatMap((slug) => Object.entries(SECURITY_FIELDS).map(([name, entry]) => [`${slug}:${name}`, entry]))),
  ...Object.fromEntries(Object.entries(LICENSING_SETTINGS_FIELDS).map(([name, entry]) => [`licensing-settings:${name}`, entry])),
  'licenses:activations': ['Aktivasyonlar', 'Activations'],
  'license-activations:status': ['Durum', 'Status'],
  'license-status-log:reason': ['Neden', 'Reason'],
  'licenses:publicId': SECURITY_FIELDS.publicId,
  'licenses:maxDevices': ['Cihaz sınırı', 'Device limit', 'Aynı anda etkin cihaz sayısı. Boşsa koltuk sayısı kullanılır.', 'Number of simultaneously active devices. Empty uses the seat count.'],
  'licenses:status': ['Durum', 'Status', 'Her değişiklik lisans durum günlüğüne yazılır. API anahtarı (MCP) durumu değiştiremez.', 'Every change is written to the license status log. An API key (MCP) cannot change the status.'],
  'licenses:statusReason': ['Durum nedeni', 'Status reason'],
  'licenses:statusSource': ['Durumu değiştiren', 'Status changed by'],
  'licenses:statusChangedAt': ['Durum değişikliği', 'Status changed at'],
  'products:licensing': ['Lisanslama API\'si', 'Licensing API', 'Masaüstü/sunucu programlarının lisans doğrulaması. Yalnız yönetici değiştirir.', 'License validation for desktop/server programs. Administrators only.'],
  'products:licensing.enabled': ['Lisanslama API\'si açık', 'Licensing API enabled'],
  'products:licensing.code': ['Lisanslama kodu', 'Licensing code', 'Programlara gömülür (ör. studio-pro); kaydedildikten sonra değiştirilemez.', 'Embedded in programs (e.g. studio-pro); cannot change once saved.'],
  'users:name': ['Ad soyad', 'Full name'],
  'customers:name': ['Ad soyad', 'Full name'],
  'customers:notes': ['Dahili notlar', 'Internal notes', 'Yalnız personel görür; müşteri görmez.', 'Visible to staff only, never to the customer.'],
  'customers:taxNumber': ['Vergi no / TCKN', 'Tax no / national ID'],
  'pages:slug': ['Slug (sayfa adresi)', 'Slug', 'Ana sayfa için "home" kullanın. Boşsa başlıktan üretilir.', 'Use "home" for the home page. Generated from the title when empty.'],
  'pages:pageType': ['Sayfa türü', 'Page type', 'Standart/Landing: /<slug> adresinde yayınlanır. Şablon: sitede görünmez; "Çoğalt" ile yeni sayfa başlatın.', 'Standard/Landing: published at /<slug>. Template: never public; use "Duplicate" to start a new page.'],
  'pages:title': ['Sayfa başlığı', 'Page title', 'Tarayıcı sekmesinde ve admin listesinde görünür.', 'Shown in the browser tab and admin lists.'],
  'products:title': ['Ürün adı', 'Product name'],
  'products:layout': [
    'Sayfa blokları', 'Page blocks',
    'Boşsa ürün sayfası varsayılan sırayla çizilir. "Ürün:" blokları ürün kaydındaki verileri gösterir (içerik kopyalanmaz); ilk "Ürün:" bloğunu eklediğinizde sıra sizindir: eklemediğiniz bölüm görünmez. "Ürün: Sürümler ve Teklif İste" zorunludur (taşınabilir, silinemez); "Ürün: Giriş" en üstte kalır.',
    'Empty: the product page uses the default order. "Product:" blocks show the data of this product record (nothing is copied); once you add the first "Product:" block the order is yours and sections you leave out are not shown. "Product: Editions and quote" is required (movable, not removable); "Product: Hero" stays on top.',
  ],
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

const STATUS_OPTION_LABELS: Record<string, readonly [string, string]> = {
  active: ['Aktif', 'Active'], suspended: ['Askıda', 'Suspended'], revoked: ['İptal edildi', 'Revoked'], expired: ['Süresi doldu', 'Expired'],
}
const REASON_OPTION_LABELS: Record<string, readonly [string, string]> = {
  manual: ['Elle (yönetici)', 'Manual (administrator)'],
  payment_refund: ['Ödeme iadesi', 'Payment refund'],
  payment_dispute: ['Ödeme itirazı', 'Payment dispute'],
  rule_ip_spread: ['Kural: IP dağılımı', 'Rule: IP spread'],
  rule_geo_spread: ['Kural: ülke dağılımı', 'Rule: country spread'],
  rule_impossible_travel: ['Kural: imkânsız seyahat', 'Rule: impossible travel'],
  rule_activation_burst: ['Kural: aktivasyon patlaması', 'Rule: activation burst'],
  rule_activation_churn: ['Kural: aktivasyon döngüsü', 'Rule: activation churn'],
  rule_clone_suspected: ['Kural: klon şüphesi', 'Rule: suspected clone'],
  expiry: ['Süre bitişi', 'Expiry'],
  restore: ['Geri alma', 'Restore'],
}
const SOURCE_OPTION_LABELS: Record<string, readonly [string, string]> = {
  admin: ['Yönetici', 'Administrator'], mcp: ['API anahtarı (MCP)', 'API key (MCP)'], payment: ['Ödeme', 'Payment'],
  rule: ['Kural motoru', 'Rule engine'], system: ['Sistem', 'System'], import: ['İçe aktarma', 'Import'], customer: ['Müşteri', 'Customer'],
  api: ['Lisanslama API\'si', 'Licensing API'], portal: ['Müşteri portalı', 'Customer portal'], webhook: ['Ödeme bildirimi', 'Payment webhook'],
}
const SEVERITY_OPTION_LABELS: Record<string, readonly [string, string]> = {
  info: ['Bilgi', 'Info'], low: ['Düşük', 'Low'], medium: ['Orta', 'Medium'], high: ['Yüksek', 'High'], critical: ['Kritik', 'Critical'],
}
const EVENT_TYPE_LABELS: Record<string, readonly [string, string]> = {
  'activation.created': ['Yeni cihaz aktivasyonu', 'Device activated'],
  'activation.rebind': ['Cihaz yeniden bağlandı', 'Device rebound'],
  'activation.ended': ['Cihaz aktivasyonu sona erdi', 'Device activation ended'],
  'activation.seat_limit': ['Cihaz sınırına ulaşıldı', 'Seat limit reached'],
  'activation.burst': ['Kısa sürede çok aktivasyon', 'Activation burst'],
  'activation.churn': ['Aktivasyon döngüsü', 'Activation churn'],
  'activation.clone_suspected': ['Klon şüphesi', 'Suspected clone'],
  'license.ip_spread': ['Lisans: IP dağılımı', 'License: IP spread'],
  'license.geo_spread': ['Lisans: ülke dağılımı', 'License: country spread'],
  'license.impossible_travel': ['Lisans: imkânsız seyahat', 'License: impossible travel'],
  'license.status_changed': ['Lisans durumu değişti', 'License status changed'],
  'license.expired': ['Lisans süresi doldu', 'License expired'],
  'license.created_via_mcp': ['Lisans API anahtarıyla oluşturuldu', 'License created with an API key'],
  'api.invalid_license': ['Geçersiz lisans anahtarı denemesi', 'Invalid license key attempt'],
  'api.bad_signature': ['Hatalı imza', 'Bad signature'],
  'api.replay': ['Tekrar oynatılmış istek', 'Replayed request'],
  'api.clock_skew': ['Saat kayması', 'Clock skew'],
  'api.rate_limited': ['İstek sınırı aşıldı', 'Rate limited'],
  'api.blocked_request': ['Engellenmiş istek', 'Blocked request'],
  'download.link_issued': ['İndirme bağlantısı oluşturuldu', 'Download link issued'],
  'download.started': ['İndirme başladı', 'Download started'],
  'auth.admin_login_failed': ['Yönetici girişi başarısız', 'Admin login failed'],
  'auth.admin_locked': ['Yönetici hesabı kilitlendi', 'Admin account locked'],
  'auth.admin_new_network': ['Yeni ağdan yönetici girişi', 'Admin login from a new network'],
  'auth.portal_login_failed': ['Portal girişi başarısız', 'Portal login failed'],
  'auth.portal_locked': ['Portal hesabı kilitlendi', 'Portal account locked'],
  'webhook.bad_signature': ['Ödeme bildiriminde hatalı imza', 'Payment webhook bad signature'],
  'system.rule_circuit_open': ['Kural devre kesicisi açıldı', 'Rule circuit breaker opened'],
  'system.signing_key_rotated': ['İmza anahtarı döndürüldü', 'Signing key rotated'],
  'system.events_dropped': ['Olaylar düşürüldü', 'Events dropped'],
  'system.daily_digest': ['Günlük özet', 'Daily digest'],
}
const prefixed = (name: string, labels: Record<string, readonly [string, string]>) =>
  Object.fromEntries(Object.entries(labels).map(([value, label]) => [`${name}=${value}`, label]))

/** L1 licensing core select option labels. */
const LICENSING_OPTIONS: Record<string, readonly [string, string]> = {
  ...prefixed('from', STATUS_OPTION_LABELS),
  ...prefixed('to', STATUS_OPTION_LABELS),
  'status=deactivated': ['Kaldırıldı', 'Deactivated'],
  ...prefixed('statusReason', REASON_OPTION_LABELS),
  ...prefixed('reason', REASON_OPTION_LABELS),
  ...prefixed('statusSource', SOURCE_OPTION_LABELS),
  ...prefixed('source', SOURCE_OPTION_LABELS),
  ...prefixed('severity', SEVERITY_OPTION_LABELS),
  ...prefixed('minSeverityImmediate', SEVERITY_OPTION_LABELS),
  ...prefixed('type', EVENT_TYPE_LABELS),
  'endReason=user': ['Program (kullanıcı)', 'Program (user)'],
  'endReason=admin': ['Yönetici', 'Administrator'],
  'endReason=customer_portal': ['Müşteri portalı', 'Customer portal'],
  'endReason=rebind': ['Yeniden bağlama', 'Rebind'],
  'endReason=license_revoked': ['Lisans iptali', 'License revoked'],
  'endReason=rule': ['Kural', 'Rule'],
  'platform=windows': ['Windows', 'Windows'],
  'platform=macos': ['macOS', 'macOS'],
  'platform=linux': ['Linux', 'Linux'],
  'platform=other': ['Diğer', 'Other'],
  'actionTaken=none': ['Yok', 'None'],
  'actionTaken=notified': ['Bildirildi', 'Notified'],
  'actionTaken=throttled': ['Yavaşlatıldı', 'Throttled'],
  'actionTaken=blocked': ['Engellendi', 'Blocked'],
  'actionTaken=suspended': ['Askıya alındı', 'Suspended'],
  'triage=open': ['Açık', 'Open'],
  'triage=acknowledged': ['Görüldü', 'Acknowledged'],
  'triage=resolved': ['Çözüldü', 'Resolved'],
  'triage=false_positive': ['Yanlış alarm', 'False positive'],
  'notifyState=pending': ['Bekliyor', 'Pending'],
  'notifyState=sent': ['Gönderildi', 'Sent'],
  'notifyState=failed': ['Başarısız', 'Failed'],
  'notifyState=skipped': ['Atlandı', 'Skipped'],
  'kind=ip_prefix': ['IP öneki', 'IP prefix'],
  'kind=cidr': ['IP aralığı (CIDR)', 'IP range (CIDR)'],
  'kind=activation': ['Cihaz aktivasyonu', 'Device activation'],
  'kind=license': ['Lisans', 'License'],
  'kind=fingerprint': ['Cihaz izi', 'Device fingerprint'],
  'scope=api': ['Lisanslama API\'si', 'Licensing API'],
  'scope=portal': ['Müşteri portalı', 'Customer portal'],
  'scope=all': ['Tümü', 'All'],
  'action=license.suspend': ['Lisans askıya alındı', 'License suspended'],
  'action=license.revoke': ['Lisans iptal edildi', 'License revoked'],
  'action=license.reactivate': ['Lisans yeniden etkinleştirildi', 'License reactivated'],
  'action=license.restore': ['Otomatik askı geri alındı', 'Automatic suspension restored'],
  'action=api.activate': ['API aktivasyonu', 'API activation'],
  'action=api.validate': ['API lisans doğrulaması', 'API license validation'],
  'action=api.deactivate': ['API deaktivasyonu', 'API deactivation'],
  'action=api.updates': ['API güncelleme denetimi', 'API update check'],
  'action=api.downloads/link': ['API indirme bağlantısı', 'API download link'],
  'action=activation.deactivate': ['Cihaz kaldırıldı', 'Device deactivated'],
  'action=block.add': ['Engel eklendi', 'Block added'],
  'action=block.lift': ['Engel kaldırıldı', 'Block lifted'],
  'action=event.triage': ['Olay incelendi', 'Event triaged'],
  'action=settings.update': ['Ayarlar değişti', 'Settings updated'],
  'action=signing_key.rotate': ['İmza anahtarı döndürüldü', 'Signing key rotated'],
  'actorKind=admin': ['Yönetici', 'Administrator'],
  'actorKind=system': ['Sistem', 'System'],
  'actorKind=rule': ['Kural motoru', 'Rule engine'],
  'result=ok': ['Başarılı', 'Succeeded'],
  'result=denied': ['Reddedildi', 'Denied'],
  'result=error': ['Hata', 'Error'],
  'countrySource=none': ['Kullanma', 'Disabled'],
  'countrySource=cloudflare_header': ['Cloudflare ülke başlığı', 'Cloudflare country header'],
  'mode=off': ['Kapalı', 'Off'],
  'mode=observe': ['İzle', 'Observe'],
  'mode=notify': ['Bildir', 'Notify'],
  'mode=suspend': ['Askıya al', 'Suspend'],
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
  // Licensing core (L1)
  ...LICENSING_OPTIONS,
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
    if ((f.type === 'array' || f.type === 'blocks') && row) {
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

/** SEO plugin default fields (`meta.*`) carry English auto-labels; TR/EN replacements keyed by field name. */
export const SEO_FIELD_LABELS: Record<string, Localized> = {
  overview: loc('Genel bakış', 'Overview'),
  title: loc('Meta başlığı', 'Meta title'),
  description: loc('Meta açıklaması', 'Meta description'),
  image: loc('Meta görseli', 'Meta image'),
  preview: loc('Arama sonucu önizlemesi', 'Search result preview'),
}

/** Plugin-seo `fields` override: label every default field in TR/EN (list column picker, SEO tab). */
export function localizeSeoFields<T extends Field>({ defaultFields }: { defaultFields: T[] }): T[] {
  return defaultFields.map((f) => {
    const name = 'name' in f ? (f.name as string) : undefined
    const label = name ? SEO_FIELD_LABELS[name] : undefined
    return label ? ({ ...f, label } as T) : f
  })
}

/**
 * V1 "Hareket" (motion) panel labels: block `motion` group fields, preset cards and their one-line help.
 * Used by `src/fields/block-motion.ts` (field labels/options) and the admin preset card component.
 * Keys equal the stored option values; values never change here (labels are not schema).
 */
export const MOTION_LABELS = {
  panel: loc('Hareket', 'Motion'),
  advanced: loc('Gelişmiş', 'Advanced'),
  replay: loc('Tekrar oynat', 'Replay'),
  heroNote: loc(
    'Giriş (Hero) bloğunda yalnız sayfa açılışını geciktirmeyen efektler gösterilir.',
    'Hero blocks only offer effects that never delay the first paint.',
  ),
  lcpNote: loc(
    'Sayfanın ilk bloğunda solma/yakınlaşma, kaymaya dönüştürülür (hız için).',
    'On the first block, fade/zoom becomes a slide (for page speed).',
  ),
  fields: {
    preset: loc('Efekt', 'Effect'),
    trigger: loc('Tetikleyici', 'Trigger'),
    duration: loc('Süre', 'Duration'),
    delay: loc('Gecikme', 'Delay'),
    easing: loc('Hız eğrisi', 'Easing'),
    stagger: loc('Sırayla aralık', 'Stagger interval'),
    mobile: loc('Paralaks mobilde de çalışsın', 'Run parallax on mobile too'),
  },
  descriptions: {
    trigger: loc('Efektin ne zaman oynayacağı.', 'When the effect plays.'),
    stagger: loc('Kartlı/listeli bloklarda öğeler arası gecikme (en çok 300 ms).', 'Delay between cards/items in list blocks (max 300 ms).'),
    mobile: loc('Kapalıyken paralaks yalnız tablet ve masaüstünde çalışır.', 'When off, parallax runs on tablet and desktop only.'),
  },
  presets: {
    auto: [loc('Otomatik', 'Auto'), loc('Bugünkü hafif belirme (varsayılan).', 'Current subtle reveal (default).')],
    none: [loc('Yok', 'None'), loc('Blok hareketsiz görünür.', 'The block appears without motion.')],
    fade: [loc('Belirme', 'Fade'), loc('Yerinde yavaşça görünür.', 'Fades in place.')],
    'slide-up': [loc('Yukarı kayma', 'Slide up'), loc('Aşağıdan yukarı kayarak gelir.', 'Slides up from below.')],
    'slide-down': [loc('Aşağı kayma', 'Slide down'), loc('Yukarıdan aşağı kayarak gelir.', 'Slides down from above.')],
    'slide-left': [loc('Sola kayma', 'Slide left'), loc('Sağdan sola kayarak gelir.', 'Slides in from the right.')],
    'slide-right': [loc('Sağa kayma', 'Slide right'), loc('Soldan sağa kayarak gelir.', 'Slides in from the left.')],
    'zoom-in': [loc('Yakınlaşma', 'Zoom in'), loc('Hafifçe büyüyerek belirir.', 'Grows in slightly.')],
    'parallax-soft': [loc('Paralaks', 'Parallax'), loc('Kaydırdıkça içerik zeminden hafifçe ayrışır.', 'Content drifts gently while scrolling.')],
    stagger: [loc('Sırayla', 'Stagger'), loc('Kartlar/öğeler sırayla belirir.', 'Cards and items appear one by one.')],
  },
  triggers: {
    scroll: loc('Kaydırınca (görünür olunca bir kez)', 'On scroll (once, when visible)'),
    'scroll-progress': loc('Kaydırma ilerlemesine bağlı', 'Linked to scroll progress'),
    load: loc('Sayfa açılışında', 'On page load'),
    hover: loc('Fareyle üzerine gelince', 'On hover'),
  },
  durations: {
    fast: loc('Hızlı (240 ms)', 'Fast (240 ms)'),
    base: loc('Orta (560 ms)', 'Medium (560 ms)'),
    slow: loc('Yavaş (800 ms)', 'Slow (800 ms)'),
  },
  delays: {
    '0': loc('Yok', 'None'),
    '100': loc('100 ms', '100 ms'),
    '200': loc('200 ms', '200 ms'),
    '300': loc('300 ms', '300 ms'),
  },
  easings: {
    soft: loc('Yumuşak (varsayılan)', 'Soft (default)'),
    standard: loc('Dengeli', 'Standard'),
    emphasized: loc('Vurgulu', 'Emphasized'),
  },
  staggers: {
    none: loc('Yok (hepsi birlikte)', 'None (all together)'),
    tight: loc('Sık (60 ms, varsayılan)', 'Tight (60 ms, default)'),
    relaxed: loc('Geniş (100 ms)', 'Relaxed (100 ms)'),
  },
} as const

/** V5 "Görsel düzenle" labels (leaf module so the canvas bridge chunk stays small). */
export { VISUAL_EDITOR_LABELS } from './visual-editor-labels'

/** L6a read-only security center labels (view at /admin/guvenlik; leaf module, TR/EN audited by admin-labels.test.ts). */
export { SECURITY_CENTER_LABELS } from './security-center-labels'
