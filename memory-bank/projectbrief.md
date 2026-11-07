# Proje Özeti — SoftMarket

Kapsamın tek doğru kaynağı. Çelişki olursa önce bu dosya, sonra `progress.md`.

## Amaç
Kurumsal yazılım şirketinin 5-20 yazılım ürününü tanıttığı için teklif ve demo talebi topladığı site.
Ruh: Vizrt / Blackmagic (ürün aileleri, çözümler, destek merkezi, indirmeler). Tasarım kopyası değil.

## Kesin kararlar
- **Satış modeli:** tanıtım + Teklif İste / Demo İste. Sürümlerde fiyat yok; her sürüm teklif talebine gider.
- **Stack:** Next.js 15 (App Router), Payload CMS 3, SQLite, TypeScript strict, Node 24, pnpm.
- **Diller:** TR (varsayılan, `localePrefix: 'always'` → `/tr/...`) + EN (`/en/...`). Lokalize slug.
- **Analitik:** Cloudflare Web Analytics; Umami Postgres gerektirdiği için seçilmedi. Çerezsiz; analitik çerez bandı gerekmez. Token yoksa beacon yüklenmez; admin/portal hariç.
- **Online ödeme:** tamamen kaldırıldı.
- **Lisans:** site içi modül; yetkili yönetici panel/API/MCP üzerinden müşteriye atar. CSPRNG anahtar sunucuda üretilir.
- **Dağıtım:** systemd self-host (tek VPS), Caddy ile otomatik TLS.
- **AI ile yönetilebilirlik (kritik):** `AGENTS.md`, Makefile/pnpm script'leri, JSON seed/import, Payload REST/Local API, Payload MCP plugin (Faz 8a).
- **Görsel:** koyu ağırlıklı + açık bölümler; tek vurgu rengi kobalt; palet bizden. Ayrıntı: `productContext.md`.
- **Kullanıcı:** SQLite bilmiyor; manuel veritabanı müdahalesi istemiyor. Migration ve script'ler otomatik olmalı.
- **Git:** kullanıcı istemeden commit yapılmaz.

## Kapsam dışı (v1)
- e-Fatura / e-Arşiv entegrasyonu (sonra Paraşüt vb.).
- Yazılım içi aktivasyon API'si (lisans modeli buna hazır tasarlanır, uygulanmaz).
- Abonelik yenileme otomasyonu.

## Site kapsamı (özet)
- Ana sayfa; ürün kataloğu (`/tr/urunler`, aile, ürün detay sekmeleri); çözümler; referanslar; haberler; kariyer; iş ortakları; iletişim; şirket.
- Destek merkezi (`/tr/destek`): indirmeler, dokümantasyon, sürüm notları, SSS, destek talebi, iletişim.
- Dönüşüm: `/tr/demo-talep`, `/tr/teklif-iste`.
- Müşteri portalı `/tr/hesap`: özet, lisanslar, indirmeler, destek talepleri, profil.
- Yasal: KVKK, gizlilik, çerez, kullanım koşulları, EULA.
- Admin paneli: `/admin` (Payload).
- Tam sayfa haritası ve koleksiyon listesi: `systemPatterns.md`.

## Başarı kriterleri (plan §8)
- `make dev` sonrası `127.0.0.1:3100/tr`, `/en`, `/admin` açılır; seed sonrası sayfalar dolu.
- `pnpm typecheck && pnpm lint && pnpm test` geçer (lisans atama, abonelik süresi, access control).
- Playwright e2e: katalog → ürün → Teklif İste; yönetici lisans atar → lisans portalda → licensed indirme açılır; Teklif İste gönderimi; dil değiştirme + hreflang.
- Lighthouse ≥ 90 (Performance/SEO/A11y); WCAG AA kontrast.
- MCP üzerinden ajanla ürün ekle/güncelle testi.
- systemd ile staging sunucuda; Caddy TLS; backup/restore denemesi.

## Kaynaklar
- Güncel repo planı: `docs/implementation-plan.md` (harici kaynak salt okunur olduğu için çalışma kopyası).
- Onaylı kaynak plan: `/Users/ozcelik/.claude/plans/imdi-yapmam-z-gereken-proje-greedy-lynx.md`
- Ajan kuralları: `/Users/ozcelik/dev/softmarket/AGENTS.md`
