# SoftMarket

Kurumsal yazılım şirketinin 5-20 ürününü tanıttığı, teklif ve demo talebi topladığı, destek merkezi ve müşteri portalı içeren web sitesi. Şirket adı henüz kesinleşmediği için metinlerde `SoftMarket` yer tutucusu kullanılır.

- Online ödeme ve sepet yoktur. Her sürüm için **Teklif İste**, genel tanıtım için **Demo İste** akışı çalışır.
- Lisanslar personel tarafından müşteriye atanır; müşteri portalında (`/tr/hesap`, `/en/account`) görüntülenir.

## Mimari

- **Uygulama:** Next.js 15 (App Router) + Payload CMS 3 tek uygulama olarak çalışır. Site `src/app/(frontend)/[locale]`, yönetim paneli ve API `src/app/(payload)` altındadır.
- **Veritabanı:** SQLite (`@payloadcms/db-sqlite`). Şema değişiklikleri migration ile yapılır; `push` kapalıdır.
- **Dağıtım:** Docker kullanılmaz. Tek VPS üzerinde systemd (uygulama), Caddy (otomatik TLS, ters vekil) ve Litestream (SQLite sürekli yedekleme) çalışır.
- **Diller:** Türkçe (varsayılan, `/tr`) ve İngilizce (`/en`). Metinler `src/i18n/messages/{tr,en}.json` içindedir; yol eşlemesi `src/i18n/paths.ts` dosyasındadır.
- **Yönetilebilirlik:** İçerik yönetimi admin paneli üzerinden yapılır. Payload REST/Local API ve MCP entegrasyonu planlanmıştır (Faz 8).

## Gereksinimler

- Node.js `>=24 <25`
- pnpm `>=12 <13` (`packageManager`: `pnpm@12.16.1`)

## Hızlı başlangıç

```sh
pnpm install
cp .env.example .env        # değerleri doldurun
pnpm migrate                # veritabanını hazırlar
pnpm ensure-forms           # demo, teklif, iletişim ve destek formlarını oluşturur (idempotent)
pnpm dev                    # http://127.0.0.1:3100
```

Yerel adres: `http://127.0.0.1:3100` (`/tr`, `/en`, yönetim paneli `/admin`). `localhost:3000` bu projeye ait değildir.

> Not: Yeni migration için `pnpm migrate:create <ad>` kullanın; düz `payload migrate:create` bu projede çalışmaz. Şema değişikliğinden sonra `pnpm migrate` çalıştırın.

## Önemli komutlar

Makefile hedefleri (`make <hedef>`):

| Hedef | Ne yapar |
|---|---|
| `make dev` | `pnpm dev` (port 3100) |
| `make migrate` | `pnpm migrate` |
| `make seed` | `pnpm seed` (`scripts/seed.ts`) |
| `make backup` | `scripts/backup.sh` |
| `make restore BACKUP=<yedek-dizini>` | `scripts/restore.sh` ile geri yükleme |
| `make deploy` | `scripts/deploy.sh` (`DEPLOY_HOST` gerekir) |
| `make provision` | `scripts/provision.sh` (sunucu kurulumu, Ubuntu 24.04, root) |
| `make logs` | `DEPLOY_HOST` üzerinde `journalctl -u softmarket -f` |
| `make typecheck` / `make lint` / `make test` | `pnpm typecheck` / `pnpm lint` / `pnpm test` |

Diğer pnpm betikleri:

| Komut | Açıklama |
|---|---|
| `pnpm build` / `pnpm start` | Üretim derlemesi ve çalıştırma |
| `pnpm migrate:create <ad>` | Yeni migration dosyası oluşturur |
| `pnpm migrate:status` | Migration durumunu gösterir |
| `pnpm generate:types` | `payload-types.ts` dosyasını yeniden üretir |
| `pnpm generate:importmap` | Payload import map dosyasını yeniden üretir |
| `pnpm ensure-forms` | Form tanımlarını TR/EN olarak oluşturur veya günceller |
| `pnpm test:e2e` | Build alır ve Playwright testlerini çalıştırır (Chromium gerekir) |

Kalite kontrolü: `pnpm typecheck && pnpm lint && pnpm test`. E2E için bir kez `pnpm exec playwright install chromium` çalıştırın.

## Dizin yapısı

```
src/
  app/(frontend)/[locale]/  site sayfaları (urunler, cozumler, destek, hesap, yasal, ...)
  app/(payload)/            yönetim paneli ve Payload API
  collections/              koleksiyonlar (ürünler, sürümler, lisanslar, destek, ...)
  globals/                  header, footer, site-settings
  blocks/                   sayfa blokları (Hero, FeatureGrid, SpecTable, ...)
  access/                   erişim kuralları
  lib/                      lisans, form, portal, arama ve sorgu mantığı
  i18n/                     routing, yol eşlemesi, mesajlar (tr.json, en.json)
  migrations/               SQLite migration dosyaları
  components/, fields/, hooks/
content/                    yasal metin taslakları (content/legal/{tr,en})
scripts/                    seed, ensure-forms, backup, restore, deploy, provision
deploy/                     Caddyfile, systemd ve Litestream yapılandırmaları
tests/unit/, tests/e2e/     Vitest ve Playwright testleri
memory-bank/                proje hafızası (aşağıya bakın)
```

## İçerik yönetimi

- Ürün, sürüm, çözüm, haber, referans, doküman, indirme ve SSS içerikleri admin panelinden (`/admin`) yönetilir. Taslak ve sürüm geçmişi olan koleksiyonlar `drafts` ile çalışır.
- Lisans yalnızca yetkili yönetici tarafından atanır; anahtar sunucuda üretilir ve müşteri lisansı doğrudan düzenleyemez.
- Form bildirimleri `FORM_NOTIFICATION_EMAIL` (isteğe bağlı) veya site iletişim adresine gider. SMTP yapılandırılmamışsa bildirim konsola yazılır.
- Yapay zekâ ajanı ile içerik yönetimi (Payload MCP, JSON içe aktarma) Faz 8 kapsamındadır ve henüz yoktur.

## Ortam değişkenleri

`.env.example` dosyasındaki tüm anahtarlar listelenmiştir. Üretimde zorunlu olanlar:

| Değişken | Açıklama |
|---|---|
| `PAYLOAD_SECRET` | Payload oturum ve imza sırrı |
| `DATABASE_URI` | SQLite veritabanı yolu |
| `NEXT_PUBLIC_SERVER_URL` | Sitenin kanonik adresi (örn. `https://alanadi`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | E-posta gönderimi. Host boş veya `CHANGE_` ile başlıyorsa konsol adaptörü kullanılır |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile. Üretimde yoksa form gönderimi ve müşteri kaydı kapalıdır |
| `FORM_PROXY_SECRET` | En az 32 karakter. **Caddy ve uygulamada aynı değer** olmalıdır; hız sınırı için gerekir |
| `FORM_NOTIFICATION_EMAIL` | İsteğe bağlı form bildirim alıcısı |
| `UPLOADS_DIR` | Yüklenen dosyaların klasörü |
| `LITESTREAM_BUCKET`, `LITESTREAM_PATH`, `LITESTREAM_ENDPOINT`, `LITESTREAM_REGION`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | Litestream yedek hedefi |
| `DOMAIN`, `DEPLOY_HOST` | Caddy alan adı ve dağıtım sunucusu (SSH hedefi) |

`.env` dosyası ve kimlik bilgileri commit edilmez.

## Dağıtım

1. Sunucuyu hazırlayın: `make provision` (Ubuntu 24.04, root). Node 24, pnpm, Caddy, rsync ve sqlite3 kurar.
2. `.env` değerlerini sunucuya ve yerel ortama göre ayarlayın. `FORM_PROXY_SECRET` değerini Caddy ile aynı yapın.
3. `make deploy` (`DEPLOY_HOST` gerekir): kodu `/opt/softmarket/releases/<sürüm>` altına kopyalar ve `data`/`uploads` klasörlerini paylaşımlı konumlara bağlar. Kurulum ve servis adımları `scripts/deploy.sh` içindedir.
4. `make logs` ile servis günlüklerini izleyin.

Yedekleme: `make backup` SQLite veritabanını ve yüklemeleri alır; Litestream veritabanını sürekli olarak yedekler. Geri yükleme için `make restore BACKUP=<yedek-dizini>` kullanın. `scripts/restore.sh` varsayılan olarak `softmarket` ve `litestream` servislerini durdurur (`RESTORE_SERVICE=0` ile bu adım atlanır).

## Memory Bank

Proje bağlamı ve durum takibi `memory-bank/` altındadır. Sırayla okuyun: `projectbrief.md` → `productContext.md` → `systemPatterns.md` → `techContext.md` → `activeContext.md` → `progress.md`. Ajan kuralları için `AGENTS.md` dosyasına bakın.

## Yasal metinler

`content/legal/{tr,en}/` altındaki KVKK aydınlatma, gizlilik, çerez, kullanım koşulları ve EULA metinleri **taslaktır**. Yayın öncesi hukuk danışmanı tarafından incelenmelidir; köşeli parantezli alanlar doldurulmalıdır.
