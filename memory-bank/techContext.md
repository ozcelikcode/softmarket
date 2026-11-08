# Teknik Bağlam

## Sürümler
- Node `>=24.22.1 <25` (Payload 3.92+), pnpm `12.16.1`, TypeScript `5.7.3` (strict).
- Next.js `15.4.11` (App Router), React / React-DOM `19.2.6`.
- Payload CMS ve tüm `@payloadcms/*` `3.93.0` (tam sabit): SQLite, Next/UI, Lexical, Nodemailer, live-preview-react; plugin: seo, form-builder, search, mcp. Next/React peer uyumu korunur. Lexical `0.50.0` yalnız Payload re-export'ları üzerinden kullanılır; özel node yok, içerik dönüşümü gerekmedi.
- Tailwind CSS `^4.3.4`, `@tailwindcss/postcss` `^4.3.4`; Radix UI `^1.8.1`; Motion `^14.9.1`; Lucide React `^1.68.0`.
- `next-intl` `^4.14.9`; `sharp` `0.35.4`.
- Vitest `4.0.18`; Playwright `1.63.0`; ESLint `^9.16.0` (`eslint-config-next` `15.4.11`); tsx `4.23.15`.
- Caddy (host) (otomatik TLS).

## Yerel geliştirme
- Adres: **http://127.0.0.1:3100** (web). `localhost:3000` başka projeye ait; kullanma.
- Codex sandbox'ında DB/HTTP için `network_access=true` gerekir.

## Makefile hedefleri
- `make dev`: Next'i host üzerinde çalıştırır; SQLite dosyası `data/` altındadır.

## pnpm script'leri
`dev`, `build`, `start`, `typecheck`, `lint`, `test`, `test:e2e`, `generate:types`, `generate:importmap`, `migrate`, `migrate:create`, `migrate:status`, `seed`, `ensure-forms`, `content:import`.
- Kontroller: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`. E2E: `pnpm test:e2e` (Chromium kurulumu gerekir).
- Tip ve import map: `pnpm generate:types`, `pnpm generate:importmap`.

## Veritabanı ve migration
- **DB push kapalı.** Şema değişikliği: `pnpm migrate:create <ad>` (tsx sarmalı; düz `payload migrate:create` başarısız olur), sonra `pnpm migrate`.
- Mevcut migration'ı elle değiştirme; yeni migration ekle.

## Seed ve betikler
- `content/seed/` (JSON), `scripts/seed.ts`, `scripts/backup.sh`, `scripts/restore.sh`.
- `scripts/ensure-forms.ts`: dört form tanımını TR/EN upsert eder; tekrar çalıştırılabilir.
- `scripts/content-import.ts` / `pnpm content:import [path] [--dry-run] [--legal]`; varsayılan `content/seed`. `make seed`: ensure-forms + content:import.

## Dağıtım
- `deploy/` altında systemd, Caddy ve Litestream yapılandırması; `.env.example` ortam değişkenleri.
- GitHub Actions CI/CD planlandı; kurulu değil.

## Kısıtlar
- Dev açıkken build yalnız `NEXT_DIST_DIR=.next-prod pnpm build`; dev sürecini durdurma ve `.next` silme. Bağımlılık kurulumu çalışan dev HMR'sini bozabilir; yönetici Node gereksinimini sağlayıp olağan restart yapar.
- `.env`, kimlik bilgileri, yerel yüklemeler ve yedekler commit edilmez.
- Git commit yalnız kullanıcı açıkça isterse.
- Ödeme SDK ve ortam değişkenleri kaldırıldı. SMTP boş/`CHANGE_` ise konsol adaptörü; gerçek SMTP gönderimi doğrulanmadı.
- Payload varsayılan erişimi `Boolean(user)`: her yeni koleksiyona açık `access` yaz.
- Boş klasörler `.gitkeep` ile tutulur.

## Araç ve ekip modeli (`takim-lideri` skill'i)
- Skill: `~/.claude/skills/takim-lideri/SKILL.md`. Ana Opus lider kod yazmaz; işi alt ajanlara dağıtır.
- Ajan dağılımı: Gemini 3.8 Flash (agy) tarama; GPT 6 Luna angarya; Claude Opus alt ajan çekirdek mimari; GPT 6.1 Terra ağır backend; Claude Sonnet 5.5 frontend/tasarım; GPT 6.1 Sol rutin ve QA; Claude Haiku 5.5 metin ve doküman; GPT 6 Astra ve Gemini 4 Argon danışmanlık.
- Kural: **yazan ≠ denetleyen.** Claude kodunu GPT Sol/Terra (High) denetler.
- Her faz sonunda çapraz QA zorunlu.
- Kota dengesi: Claude yoğun fazlardan (2-3) sonra GPT'ye geçilir.

## Ajan araçları
- Bağlam koruma için büyük çıktılar `ctx_execute` / `ctx_batch_execute` ile işlenir.
- Payload MCP plugin `@payloadcms/plugin-mcp@3.93.0`; peer Payload 3.93.0. `/api/mcp`; kurulum/araç argüman sözleşmesi AGENTS.md içinde. SDK `1.30.0`; upstream `mcp-handler@1.1.0` peer'i `1.26.0` olduğundan pnpm uyarır (önceden de vardı); güvenlik güncellemesi düşürülmedi, gerçek handler kontrolü geçti.

## SQLite geçişi (2026-11-06)
- SQLite WAL/FULL, busy timeout 5000; Payload transaction etkin, libSQL yazma transaction `BEGIN IMMEDIATE`.
- Migration: `20261106_145404_initial_sqlite`, `20261106_150000_sqlite_integrity`.
- Tek VPS: systemd, host Caddy, Litestream; kalıcı veri `data/`, `uploads/`. Yerel port 3100.

## Tanıtım ve teklif geçişi (2026-11-06)
- Yeni migration: `20261106_151826_remove_online_sales`; eski migration dosyaları değiştirilmedi.
- `stripe`, `@react-email/components`, `@react-email/render` pnpm ile kaldırıldı.
- Bu görevde build ve dev sunucu yeniden başlatma yasak; mevcut süreç yalnız HTTP ile kontrol edilir.

## Faz 4 ortamı
- `zod` form doğrulama bağımlılığı eklendi.
- `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: development eksik/yer tutucu secret ile atlar, production gönderimi kapatır.
- `FORM_NOTIFICATION_EMAIL` isteğe bağlı sabit personel alıcısı; yoksa site-settings iletişim adresi, adres yoksa konsol bildirimi.
- Rate limit yalnız `FORM_PROXY_SECRET` ile doğrulanan Caddy `X-Softmarket-Client-IP` başlığına güvenir; anahtar Caddy ve uygulama ortamlarında aynı, rastgele ve en az 32 karakter olmalı. Aksi halde tüm istekler ortak limite girer; Next loopback üzerinde dinler.

## Faz 8a ortamı
- `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` isteğe bağlı public site token; Cloudflare auto-injection kapalı tutulmalı, uygulama manuel embed eder.
- Yeni migration: `20261106_164616_phase8a_content_mcp` (users API key, SSS slug ve plugin anahtar tablosu; plugin anahtar koleksiyonu erişime kapalı).

- Faz 8a medya kimliği: `media.seedPath` unique; Payload dosya adını çakışma nedeniyle değiştirse de tekrar import aynı kaydı/dosyayı günceller. Migration `20261106_165449_phase8a_media_identity` uygulandı.
