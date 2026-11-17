# Barındırma: alt alan adı ve VPS'siz (paylaşımlı/yönetilen) hosting fizibilitesi

> Durum: değerlendirme (2026-11-17). Kod/şema değişmedi. İlgili plan: `docs/plan-licensing-security.md`.
> Bugünkü düzen: tek VPS, systemd `softmarket.service` (`pnpm start`, 127.0.0.1:3000), host Caddy (otomatik TLS, `X-Softmarket-Client-IP` + `FORM_PROXY_SECRET`), Litestream (S3), `payments-reconcile.timer` (15 dk), `scripts/deploy.sh` (sunucuda `pnpm build` + `pnpm migrate`), SQLite WAL + süreç içi yazma kuyruğu (`src/lib/db-serial-transactions.ts`).

## Kısa cevap

| Soru | Karar |
|---|---|
| (a) Siteyi veya lisans API'sini alt alan adında çalıştırmak (`lisans.alanadi.com`, `api.alanadi.com`) | **Olur.** Bugünkü VPS'te yalnız DNS + Caddy bloğu. Lisans API'si için **önerilir**. |
| (b) VPS yerine cPanel/Plesk Node.js (Passenger) paylaşımlı hosting | **Koşullu olur — lisans API'si ve ödeme için önerilmez.** Aşağıdaki minimum özelliklerin tamamı yazılı olarak sağlanmadıkça kurulmamalı. |
| (c) VPS'siz ama tek örnekli yönetilen konteyner + kalıcı disk (ör. kalıcı volume'lü PaaS) | **Koşullu olur.** Tek örnek ve kalıcı disk sabitlenirse mimari değişmeden çalışır; yedek Litestream ile korunur. |

Öneri: **VPS'te kalın, lisans API'sini `lisans.<alan-adi>` alt alan adından yayınlayın.** Aylık maliyet farkı küçük; lisans doğrulaması ve ödeme webhook'ları için kalıcı tek süreç, sistem zamanlayıcısı ve gerçek zamanlı yedek gereklidir.

## (a) Alt alan adı

**Ne gerekir:** DNS `A/AAAA lisans → VPS IP`; Caddy'ye ikinci site bloğu. Aynı süreç, ayrı host:

```caddy
lisans.{$DOMAIN} {
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        -Server
    }
    request_body { max_size 16KB }
    @api path /api/v1/licensing/*
    handle @api {
        reverse_proxy 127.0.0.1:3000 {
            header_up X-Softmarket-Client-IP {remote_host}
            header_up X-Softmarket-Proxy-Secret {$FORM_PROXY_SECRET}
        }
    }
    handle { respond 404 }
}
```

(İndirme ucu `/api/v1/licensing/dl/*` büyük dosya akıtır; gövde sınırı yalnız istek içindir, yanıtı etkilemez.)

**Etkiler:**

- **Çerez:** Payload ve portal çerezleri bugün `Domain` özniteliği olmadan (host-only) yazılır; alt alan adına gitmez. Bu korunmalı: `Domain=.alanadi.com` **yapılmamalı** (alt alan adındaki bir açık oturum çerezlerini okuyabilir hale gelir). Lisans API'si çerez kullanmaz.
- **SameSite:** değişmez (Lax). Alt alan adı "same-site" sayılır; bu nedenle admin uçlarındaki same-origin (`Origin == Host`) ve `Sec-Fetch-Site: same-origin` kontrolü (`guardAdminSession`) zaten SameSite'tan daha sıkıdır ve korunur.
- **CORS:** gerekmez (masaüstü/sunucu programı tarayıcı değildir). `Access-Control-Allow-Origin` yazılmaz; tarayıcıdan çağrı bilinçli olarak desteklenmez.
- **HSTS `includeSubDomains`** zaten açık: tüm alt alan adları HTTPS olmak zorunda (Caddy otomatik sertifika alır).
- **CSP/middleware:** `/api` middleware dışında; etkisi yok.
- **Artılar:** programa gömülü adres pazarlama sitesinden bağımsız (site yeniden tasarlanır/taşınır, programlar etkilenmez); ileride API ayrı makineye taşınabilir; Cloudflare/WAF kuralı ve rate limit host'a özel yazılabilir; loglar ayrışır.
- **Eksiler:** ek DNS kaydı ve sertifika (otomatik); yanlış Caddy kuralıyla admin/portalın alt alan adından açılma riski → yukarıdaki "yalnız `/api/v1/licensing/*`" kuralı ve L10 testi (`curl https://lisans…/admin` → 404).
- **Cloudflare proxy kullanılırsa:** istemci IP'si `CF-Connecting-IP` olur; Caddy'de `trusted_proxies` yalnız Cloudflare aralıklarıyla ayarlanmalı, aksi halde rate limit tek IP'ye çöker.

## (b) Paylaşımlı / yönetilen hosting (cPanel "Setup Node.js App"/Application Manager, Plesk Node.js, CloudLinux Node.js Selector — Phusion Passenger veya LiteSpeed lsnode)

### Uyum tablosu

| Gereksinim (bugünkü sistem) | Paylaşımlı hosting gerçeği | Sonuç |
|---|---|---|
| Kalıcı, **tek** Node süreci | Passenger süreci isteğe göre başlatır, boşta kapatır (pool idle time), yük altında **birden çok süreç** açabilir; Node için varsayılan "sınırsız eşzamanlılık" ipucu ile genelde 1 süreç kalır ama garanti değil; ayar çoğu planda müşteriye kapalı | **Kritik risk.** İkinci süreç: `db-serial-transactions` süreç içi olduğundan eşzamanlı yazımda `SQLITE_BUSY`/kayıp güncelleme koruması kaybolur; bellek içi rate limit, nonce önbelleği, olay tamponu, Turnstile/form limiti süreç başına bölünür (atlatma). Gerekli: `max pool/instances = 1`, `min instances = 1`, idle kapatma kapalı. |
| Node `>=24.22.1 <25` | Seçici sürümleri sağlayıcıya bağlı, çoğu zaman geride | Sürüm yoksa **olmaz**. |
| `next build` (2–4 GB RAM, dakikalar) | LVE bellek/süreç limitleri (çoğu 1–2 GB) build'i öldürür | Build **CI'da** yapılmalı, sunucuya derlenmiş çıktı (`.next` / `output: 'standalone'`) yüklenmeli → `deploy.sh` yeniden yazılır. |
| Çalışma belleği (Next + Payload + sharp) ~400–800 MB RSS | LVE limiti aşılırsa süreç sessizce öldürülür; lsnode birikmesi "resource temporarily unavailable" | En az 2 GB garantili RAM. |
| Yazılabilir kalıcı dizin (`data/`, `uploads/`) web kökü dışında | Genelde ev dizini; sağlanır | Web kökü dışında olmalı (SQLite dosyası indirilebilir olmamalı). |
| SQLite WAL (yerel disk, paylaşımlı bellek dosyaları `-wal`/`-shm`) | Ağ dosya sistemi (NFS) kullanan hostlarda WAL/kilit güvenilmez | **Yerel disk** yazılı teyit gerekli. |
| systemd timer'lar: `payments-reconcile` (15 dk), lisans `licensing:sweep` (5 dk), bildirim kuyruğu, saklama temizliği | cPanel/Plesk **cron** var (çoğunda en sık 5 dk; bazıları 15 dk) | Cron ile karşılanır; komut ortamında `.env` yüklenmeli, aynı DB'ye ikinci süreç olarak yazar (kısa süreli; WAL + `busy_timeout` 5000 ile kabul edilebilir, ama süreçler arası kuyruk yok). |
| Litestream (sürekli WAL replikasyonu, RPO saniyeler) | Kalıcı yan süreç çalıştırılamaz | Yerine cron ile `sqlite3 .backup` / `VACUUM INTO` + uploads tar + dış depoya (rclone/S3) yükleme; **RPO = cron aralığı** (15–60 dk). Ödeme/lisans kaybı riski artar. |
| HTTPS | AutoSSL/Let's Encrypt; alt alan adı için de var | Olur. |
| Gerçek istemci IP'si | Caddy + `FORM_PROXY_SECRET` deseni yok; IP Apache/LiteSpeed/Passenger üzerinden `X-Forwarded-For` gelir | `requestIP()` için "güvenilen tek proxy" kipi gerekir (kod değişikliği); yanlış yapılandırmada başlık sahteciliği → rate limit atlatma. |
| Webhook erişilebilirliği (iyzico/Stripe) ve uzun istekler | Süreç uyurken ilk istek soğuk başlar (birkaç sn); bazı hostlarda istek zaman aşımı/gövde sınırı | Webhook sağlayıcıları tekrar dener; yine de idle kapatma kapalı olmalı. |
| Büyük indirme akışı (lisanslı indirme, 512 MB yükleme) | Gövde/yanıt boyutu ve süre limitleri | Sağlayıcıdan teyit; yoksa indirmeler ayrı depolamaya (S3 imzalı URL) taşınmalı → ek iş. |
| Özel başlık/HSTS/CSP | `.htaccess`/panel ile kısmen | Uygulama başlıkları Next'ten gelir; Caddy başlıkları `.htaccess`'e taşınmalı. |
| SSH + `pnpm` | Çoğunda SSH var, pnpm yoksa `corepack` | SSH zorunlu (migration, yedek, acil müdahale). |

### Minimum hosting özellikleri (hepsi yazılı teyitle)

1. Node.js **24.22.1+** (24.x) seçilebilir, SSH erişimi.
2. Uygulama başına **tek süreç** sabitlenebilir (`passenger_max_instances`/pool = 1, `min_instances = 1`) ve **boşta kapatma kapalı**; ya da Passenger yerine kalıcı süreç (PM2/supervisor) izni.
3. En az **2 GB** garantili RAM, 1 vCPU, 20 GB **yerel** (NFS değil) disk, inode sınırı ≥ 200k.
4. Web kökü dışında kalıcı yazılabilir dizin; çalışma dizininin dağıtımlar arasında korunması.
5. **Cron** en az 5 dakikada bir; komutlar uygulamanın Node sürümü ve ortam değişkenleriyle çalışabilmeli.
6. Panelden **ortam değişkeni** tanımlama (sırlar dosyaya yazılmadan) veya web kökü dışında 0600 `.env`.
7. Alt alan adı + otomatik TLS; istek gövdesi ≥ 512 MB (medya yükleme) veya yüklemeyi küçültme kararı; uzun yanıt akışına izin.
8. Gerçek istemci IP'sinin güvenilir tek başlıkla iletilmesi (sağlayıcının proxy zinciri belgelenmiş).
9. Dış yedek hedefi (S3 uyumlu) ve cron'dan erişim.

Bunlardan biri yoksa paylaşımlı hosting **olmaz**. Hepsi varsa da bu sunucu "VPS'e yakın" bir planı demektir; fiyat avantajı genelde kalmaz.

### Gerekli kod/operasyon değişiklikleri (paylaşımlı hostinge geçilirse, ~2–3 gün)

- `next.config` `output: 'standalone'` + Passenger giriş dosyası (`server.js`, `PORT`'u Passenger'dan okur); CI'da build, artefakt yükleme; `deploy.sh` yerine artefakt dağıtımı + `pnpm migrate` SSH adımı.
- `requestIP()` için yapılandırılabilir güvenilen proxy kipi (yalnız loopback'ten gelen `X-Forwarded-For`'un son değeri).
- Süreç başlangıcında "ikinci süreç" tespiti: `data/` içinde `flock` tabanlı tekil kilit; kilidi alamayan süreç yazma yapan işleri (lisans API'si, webhook) 503 ile reddeder ve kritik olay yazar (fail-closed). VPS'te de zararsız bir koruma olarak önerilir.
- Litestream yerine `scripts/backup.sh` cron sürümü + dış yükleme; geri yükleme provası.
- systemd timer'lar → cron satırları (`payments:reconcile`, `licensing:sweep`).

## (c) Yönetilen konteyner + kalıcı disk

Tek örnek (`min=max=1`), kalıcı volume (`data/`, `uploads/`), sürekli çalışan süreç, cron/zamanlanmış görev ve yan süreç (Litestream) destekleyen bir platformda mevcut mimari korunur. Koşullar: otomatik ölçekleme **kapalı**, sıfıra ölçekleme kapalı, volume tek örneğe bağlı, sağlayıcı bölgesi KVKK değerlendirmesinden geçmiş (yurt dışı aktarım). Dağıtımda kısa kesinti kabul edilir (tek örnek, blue/green yok).

## Kaynaklar

- cPanel — Node.js uygulaması kurma (Application Manager, Passenger): https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/
- cPanel — Passenger uygulamaları (ters port bağlama): https://docs.cpanel.net/knowledge-base/web-services/using-passenger-applications
- Plesk — Next.js desteği (Obsidian 18.0.81+, Passenger): https://support.plesk.com/hc/en-us/articles/12376965359511-Does-Plesk-support-Next-JS
- Plesk forum — Passenger süreç havuzu sabitleme: https://talk.plesk.com/threads/how-to-configure-a-fixed-process-pool-for-nodejs-with-passenger.362847/
- Phusion Passenger — Node.js dinamik süreç ölçekleme: https://www.phusionpassenger.com/library/indepth/nodejs/dynamic_scaling_of_app_processes/nginx/
- Phusion Passenger — Node.js istek dengeleme: https://www.phusionpassenger.com/library/indepth/nodejs/request_load_balancing.html
- Phusion Passenger — Apache optimizasyonu (havuz boyutu): https://www.phusionpassenger.com/library/config/apache/optimization/
- CloudLinux — limitler (LVE): https://docs.cloudlinux.com/cloudlinuxos/limits/
- CloudLinux — web arayüzünden başlatılan süreçlerin (Node.js) limit kipi: https://cloudlinux.zendesk.com/hc/en-us/articles/21229976203804-What-are-web-interface-resource-limiting-modes
- LiteSpeed — CloudLinux/lsnode süreç birikmesi: https://docs.litespeedtech.com/lsws/cp/cpanel/ts-cloudlinux/
- SQLite — WAL ve ağ dosya sistemleri: https://www.sqlite.org/wal.html
