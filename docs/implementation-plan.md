> Faz 8a çalışma kopyası. Kaynak plan sandbox dışında salt okunur: /Users/ozcelik/.claude/plans/imdi-yapmam-z-gereken-proje-greedy-lynx.md
> 2026-11-06 karar: Umami Postgres gerektirdiği için Cloudflare Web Analytics; çerezsiz, analitik için çerez bandı gerekmez. Güncel SQLite/systemd mimarisi için memory-bank/projectbrief.md esas alınır.

# SoftMarket — Kurumsal Yazılım Tanıtım + Satış Sitesi Planı

## Context
Boş repo (`/Users/ozcelik/dev/softmarket`: sadece README). Kurumsal bir şirketin 5-20 yazılım ürününü tanıttığı ve kısmen online sattığı site. Ruh: Vizrt / Blackmagic gibi büyük ürün şirketi (ürün aileleri, çözümler, destek merkezi, indirmeler); tasarım kopyası değil. Görünüm: yeni nesil, minimal, profesyonel, kapsamlı ama abartısız. Site kendi sunucumuzda, **yapay zekâ ajanlarınca kolay yönetilebilir** olmalı (manuel panel tıklaması değil; API/MCP/script ile).

Kararlar (kullanıcı onaylı): Hibrit satış · Next.js + Payload CMS · TR + EN · Ürünler/Çözümler + Destek + Kurumsal + Müşteri portalı · iyzico + Stripe · site içi lisans modülü · Docker self-host · koyu ağırlıklı + açık bölümler · palet önerisi bizden.

---

## 1. Teknoloji Yığını

| Katman | Seçim | Neden |
|---|---|---|
| Framework | Next.js 15 (App Router, RSC, TypeScript strict) | SEO, ISR, Payload ile tek uygulama |
| CMS + backend | Payload CMS 3 (Next içine gömülü) | Self-host, tipli koleksiyonlar, auth, Local/REST API |
| Veritabanı | PostgreSQL 16 (`@payloadcms/db-postgres`) | İlişkisel sipariş/lisans verisi |
| Dosya | MinIO (S3 uyumlu, `@payloadcms/storage-s3`) | Görseller + installer dosyaları, imzalı indirme URL'leri |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) + lucide-react | Erişilebilir, token tabanlı |
| Animasyon | Motion (framer-motion) — ölçülü | Scroll reveal, ürün vitrinleri |
| Font | Geist Sans + Geist Mono (`next/font`) | Modern, nötr, teknik |
| i18n | next-intl (`/tr`, `/en`, lokalize slug) + Payload localization | İki dil, hreflang |
| Ödeme | Soyut `PaymentProvider` → iyzico (TRY) + Stripe (USD/EUR) | Para birimine/ülkeye göre yönlendirme |
| E-posta | Payload nodemailer adapter (SMTP) + React Email şablonları | Self-host uyumlu |
| Formlar | `@payloadcms/plugin-form-builder` | Demo/teklif/iletişim; CMS'ten yönetilir |
| Arama | `@payloadcms/plugin-search` (Postgres) | Ürün/doküman/SSS araması |
| SEO | `@payloadcms/plugin-seo`, sitemap, JSON-LD (Product, Organization), OG görselleri | |
| Analitik | Cloudflare Web Analytics | Çerezsiz, KVKK dostu |
| Captcha | Cloudflare Turnstile | Form spam koruması |
| Test | Vitest (unit), Playwright (e2e) | |
| Altyapı | Docker Compose: `app`, `postgres`, `minio`, `caddy` (otomatik TLS), Cloudflare Web Analytics (harici beacon) | Tek sunucu |
| CI/CD | GitHub Actions: lint → typecheck → test → build image → ssh deploy | |
| Paket yön. | pnpm | |

### AI ile yönetilebilirlik (kritik gereksinim)
- **Payload MCP plugin** (`@payloadcms/plugin-mcp`; kurulumda sürüm doğrulanacak) → ajanlar ürün/sayfa/haber CRUD'u MCP üzerinden yapar.
- Admin API key'li **REST/GraphQL** + tip üretimi (`payload generate:types`).
- **`AGENTS.md`**: mimari, koleksiyonlar, komutlar, kurallar.
- **`Makefile` / pnpm script'leri**: `dev`, `seed`, `migrate`, `backup`, `restore`, `deploy`, `logs`, `content:import <json>`.
- İçerik **JSON seed/import** (`/content/*.json`) → ürünler toplu eklenebilir.
- Migrations (`payload migrate`) kodda; yedekleme cron'u (pg_dump + MinIO mirror).

---

## 2. Tasarım Sistemi

**Ton:** sinematik koyu vitrinler (hero, ürün tanıtım), açık ve okunaklı bilgi alanları (doküman, destek, portal, teknik özellikler). Büyük tipografi, bol boşluk, tek vurgu rengi, ürün ekran görüntüsü/video öne çıkar.

**Palet (göz yormayan, saf siyah/beyaz yok):**

| Token | Koyu | Açık |
|---|---|---|
| `bg` | `#0B0D10` | `#F7F8FA` |
| `surface` | `#13161B` | `#FFFFFF` |
| `surface-2` | `#1B1F26` | `#F0F2F5` |
| `border` | `#262B33` | `#E3E6EA` |
| `text` | `#E7E9EC` | `#12161C` |
| `text-muted` | `#9AA2AD` | `#5A6370` |
| `accent` (tek marka rengi, kobalt) | `#4C7DFF` | `#2F5FE0` |
| `accent-hover` | `#6B93FF` | `#244CC0` |
| `success` / `warning` / `danger` | `#2FB37A` / `#E0A63B` / `#E5574F` | aynı tonların koyu varyantı |

- Tüm renkler `globals.css`'te CSS değişkeni; marka değişirse tek dosya. Kontrast WCAG AA kontrol edilir.
- Bölüm bazlı tema: `<Section theme="dark|light">`.
- Bileşenler: Header (mega menü), Footer, Hero (video/görsel), ProductCard, FeatureGrid, SpecTable, PricingTable (satın al / teklif iste), CaseStudyCard, LogoWall, CTA band, Breadcrumb, Tabs, Accordion (SSS), DownloadList, ReleaseNotes, Form renderer.

---

## 3. Site Haritası (TR / EN)

**Header:** Ürünler (mega menü: aileler → ürünler) · Çözümler (sektörler + kullanım senaryoları) · Destek · Şirket · Arama · Dil · Hesabım · **[Demo İste]**

- `/` Ana sayfa: hero, öne çıkan ürün aileleri, çözümler, referans logoları, vaka çalışması, haberler, CTA
- `/urunler` katalog (aile filtresi), `/urunler/[aile]`, `/urunler/[aile]/[urun]`
  - Ürün sayfası sekmeleri: Genel Bakış · Özellikler · Teknik Özellikler & Sistem Gereksinimleri · Sürümler & Fiyat · İndirmeler · Dokümantasyon
  - Sürüm (edition) bazında: `purchasable` → **Satın Al**, değilse → **Teklif İste**
- `/cozumler`, `/cozumler/[slug]` (sektör/senaryo → ilgili ürünler + vaka)
- `/destek`: `indirmeler` (ürün/sürüm/OS filtreli), `dokumantasyon/[urun]/[slug]`, `surum-notlari`, `sss`, `talep` (destek talebi), `iletisim`
- Şirket: `hakkimizda`, `referanslar` + `referanslar/[slug]` (vaka), `haberler` + `[slug]`, `kariyer` + `[slug]`, `is-ortaklari`, `iletisim`
- Dönüşüm: `demo-talep`, `teklif-iste`, `satin-al/[edition]` (checkout), `siparis/[id]/tamamlandi`
- **Müşteri portalı** `/hesap`: Özet · Lisanslarım · İndirmelerim · Siparişler & Faturalar · Destek Taleplerim · Profil (giriş/kayıt/şifre sıfırlama)
- Yasal: KVKK aydınlatma, gizlilik, çerez politikası (+ çerez banner), **mesafeli satış sözleşmesi**, **ön bilgilendirme formu**, iade/iptal, kullanım koşulları, EULA
- `/admin` Payload paneli

---

## 4. Veri Modeli (Payload Koleksiyonları)

- **Kimlik:** `users` (admin/editör, rol tabanlı) · `customers` (portal auth, firma bilgisi, vergi no)
- **Katalog:** `product-families` · `products` (blok tabanlı sayfa, özellikler, spec, sistem gereksinimi, medya) · `editions` (ürün sürümü/paketi: fiyat TRY/USD/EUR, `purchasable`, lisans tipi: süreli/kalıcı, koltuk)
- **Pazarlama:** `solutions` · `industries` · `case-studies` · `posts` · `careers` · `partners` · `pages` (blok tabanlı serbest sayfa) · `media`
- **Destek:** `docs` (ürün bazlı, sıralı) · `releases` (sürüm no, notlar, dosyalar) · `downloads` (dosya, OS, ürün, `access: public|licensed`) · `faqs` · `support-tickets` (+ mesajlar)
- **Ticaret:** `orders` (kalemler, tutar, para birimi, sağlayıcı, durum) · `licenses` (anahtar, müşteri, edition, başlangıç/bitiş, koltuk, durum)
- **Formlar:** form-builder `forms` + `form-submissions` (lead)
- **Globals:** `header`, `footer`, `site-settings` (iletişim, sosyal, yasal metin bağlantıları)
- Tüm içerik alanları `localized: true` (TR/EN). Access control: public read yalnız yayınlanmış (drafts + versions açık).

---

## 5. Satış ve Lisans Akışı

1. Edition sayfasında **Satın Al** → `satin-al/[edition]`: müşteri girişi/kayıt, fatura bilgisi, mesafeli satış + ön bilgilendirme onayı.
2. Para birimi TRY → iyzico Checkout Form; USD/EUR → Stripe Checkout.
3. Webhook (`/api/webhooks/iyzico`, `/api/webhooks/stripe`) imza doğrulama → `orders.status=paid` (idempotent).
4. `licenses` oluştur (anahtar: kriptografik rastgele, formatlı) → e-posta + portalda görünür; `licensed` indirmeler açılır.
5. Kurumsal (purchasable=false) → **Teklif İste** formu → lead e-postası + admin kaydı.
- Kapsam dışı v1: e-Fatura/e-Arşiv entegrasyonu (sonra Paraşüt vb.), yazılım içi aktivasyon API'si (lisans modeli buna hazır tasarlanır), abonelik yenileme otomasyonu.

---

## 6. Proje Yapısı

```
softmarket/
  AGENTS.md  Makefile  docker-compose.yml  Caddyfile  .env.example
  src/
    app/(frontend)/[locale]/...     # site sayfaları
    app/(frontend)/[locale]/hesap/  # portal
    app/(payload)/admin/...         # Payload admin
    app/api/webhooks/{iyzico,stripe}/route.ts
    collections/  globals/  blocks/  access/  hooks/
    components/{ui,layout,sections,product,portal}/
    lib/{payments/{provider.ts,iyzico.ts,stripe.ts},licenses/,email/,seo/}
    i18n/{routing.ts,messages/{tr,en}.json}
    payload.config.ts
  content/seed/*.json   scripts/{seed,backup,restore,import}.ts
  tests/{unit,e2e}/
```

---

## 7. Uygulama Fazları ve Ajan Dağılımı (`takim-lideri` skill'i)

Her fazda: keşif/özet → üretim → **çapraz QA** (Claude yazdıysa GPT 6.1 Sol/Terra High denetler; yazan ≠ denetleyen).

| Faz | İş | Ajan (effort) | QA |
|---|---|---|---|
| 0 | Repo iskeleti, `create-payload-app` (Next+Postgres), Docker Compose, Caddy, `.env.example`, Makefile, AGENTS.md | GPT 6 Luna (Low) + GPT 6.1 Sol (Medium) | Gemini 3.8 Flash özet kontrol |
| 1 | Mimari çekirdek: koleksiyon şeması, access control, localization, ödeme soyutlaması arayüzü | Claude Opus 5.5 alt ajan (Medium) | GPT 6.1 Terra (High) |
| 2 | Tasarım sistemi: tokenlar, tema, shadcn bileşenleri, Header/Footer/mega menü | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 3 | Sayfalar: ana sayfa, ürün katalog/detay, çözümler, kurumsal sayfalar, blok renderer | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 4 | Destek merkezi: docs, releases, downloads (imzalı URL), SSS, arama, destek talebi | GPT 6.1 Sol (Medium) | Claude Sonnet ≠ yazan; Sol yazdı → Terra (High) |
| 5 | Ödeme (iyzico + Stripe), webhook, sipariş, lisans üretimi, e-posta | GPT 6.1 Terra (High) | GPT 6.1 Sol (High) sıfır bağlam |
| 6 | Müşteri portalı (`/hesap`) | Claude Sonnet 5.5 (Medium) | GPT 6.1 Sol (High) |
| 7 | i18n metinleri, UI yazıları, hata mesajları, yasal metin taslakları, README | Claude Haiku 5.5 (Low) | — (hukuki metin: kullanıcı/hukukçu onayı) |
| 8 | Seed içerik (5-20 örnek ürün JSON), MCP plugin, backup/deploy script | GPT 6 Luna (Low) + GPT 6.1 Sol (Medium) | Terra (High) deploy/güvenlik |
| 9 | SEO, performans, erişilebilirlik, e2e testler | GPT 6.1 Sol (Medium) | Gemini 3.8 Flash rapor özeti |

Tıkanıklıkta: GPT 6 Astra + Gemini 4 Argon danışmanlığı. Kota dengesi: Claude yoğun faz (2-3) sonrası 4-5 GPT'ye.

---

## 8. Doğrulama
- `make dev` → `localhost:3000/tr`, `/en`, `/admin` açılır; seed sonrası ürün/aile/çözüm sayfaları dolu.
- `pnpm typecheck && pnpm lint && pnpm test` (Vitest: ödeme imza doğrulama, lisans üretimi, access control).
- Playwright e2e: katalog → ürün → Satın Al (iyzico sandbox + Stripe test mode) → webhook → lisans portalda görünür → licensed indirme açılır; Teklif İste formu gönderimi; dil değiştirme + hreflang.
- Lighthouse ≥ 90 (Performance/SEO/A11y), WCAG AA kontrast kontrolü.
- MCP üzerinden ajan ile ürün ekle/güncelle testi.
- `docker compose up` staging sunucuda; Caddy TLS, backup/restore denemesi.
