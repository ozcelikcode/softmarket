# F0 performans ölçümü — 2026-11-07

Ölçüm izole `NEXT_DIST_DIR=.next-perf`, `PORT=3300` ile planlandı. Tarayıcı ve 3100 dev sunucusu kullanılmadı. First Load JS ikinci build çıktısından, rota şablonu bazındadır. SSG etiketi tek başına ISR HIT kanıtı değildir. Sonuçlar yalnızca gözlemlenebilen verilerle gösterilir; `—` ölçülmedi anlamına gelir.

| Route | First Load JS | TTFB ilk/ikinci | SQLite sorgusu | ISR |
|---|---:|---:|---:|---|
| `/[locale]` | 135 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/ara` | 129 kB | — | — | dinamik |
| `/[locale]/arama` | 114 kB | — | — | dinamik |
| `/[locale]/cozumler` | 135 kB | — | — | dinamik |
| `/[locale]/cozumler/[slug]` | 146 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/demo-talep` | 136 kB | — | — | dinamik |
| `/[locale]/destek` | 129 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/destek/dokumantasyon` | 129 kB | — | — | dinamik |
| `/[locale]/destek/dokumantasyon/[product]` | 130 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/destek/dokumantasyon/[product]/[slug]` | 130 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/destek/iletisim` | 136 kB | — | — | dinamik |
| `/[locale]/destek/indirmeler` | 129 kB | — | — | dinamik |
| `/[locale]/destek/sss` | 140 kB | — | — | dinamik |
| `/[locale]/destek/surum-notlari` | 129 kB | — | — | dinamik |
| `/[locale]/destek/talep` | 136 kB | — | — | dinamik |
| `/[locale]/haberler` | 135 kB | — | — | dinamik |
| `/[locale]/haberler/[slug]` | 135 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/iletisim` | 136 kB | — | — | dinamik |
| `/[locale]/is-ortaklari` | 135 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/kariyer` | 129 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/kariyer/[slug]` | 130 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/referanslar` | 135 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/referanslar/[slug]` | 146 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/sirket/hakkimizda` | 146 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/teklif-iste` | 136 kB | — | — | dinamik |
| `/[locale]/urunler` | 135 kB | — | — | dinamik |
| `/[locale]/urunler/[family]` | 135 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/urunler/[family]/[product]` | 146 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |
| `/[locale]/yasal/[slug]` | 146 kB | — | — | SSG, 1h yalnız build çıktısında belirtilenler |

## Dokümantasyon build timeout incelemesi

`/[locale]/destek/dokumantasyon/[product]` için metadata ve sayfa `load` çağırır; `getSupportProducts` React `cache()` ile sarılmıştır. `supportVariants` ise metadata ve sayfadan ayrı çağrılır ve önbelleğe alınmamış bir `products.findByID` yapar. `getDocTree` de `cache()` kullanır ve ürün doğrulamasından sonra seçilmiş alanlarla docs sorgular. `contentStaticParams`, her şablon için sitemap verisini kullanır; `entries` React `cache()` ile sarılmış olsa da ayrı build worker'ları arasında paylaşım garanti değildir. Bunlar koddan gözlenen tekrar olasılıklarıdır; 60 saniyelik timeout nedeni olarak doğrulanmış değillerdir.

SQLite WAL, `busyTimeout: 5000` ve `transactionOptions.behavior: immediate` kullanır. `revalidatePublicContent` production build aşamasında erken döner; hook'lar yalnız değişiklik/silme işlemlerinde çağrılır. Kilit beklemesi veya eşzamanlı yazım bu koşularda ölçülmedi, dolayısıyla ne doğrulanabilir ne de dışlanabilir.


## HTTP ölçümleri

Üçüncü build sonrası 3300 üzerinde sitemap içindeki 144 URL sırayla iki GET ile ölçüldü. Önceden üretilmiş sayfalar ilk istekte HIT dönebilir; bu nedenle ilk/ikinci sütunları MISS/HIT diye etiketlenmez ve yayın sonrası invalidation testinin yerine geçmez. First Load JS rota şablonları üstteki tabloda yer alır; sorgu sayacı henüz uygulanmadığından hücreler boştur.

| URL | First Load JS | TTFB ilk / ikinci (ms) | Sorgu | HTTP ilk / ikinci | Cache ilk → ikinci |
|---|---:|---:|---:|---|---|
| `/tr` | şablon tablosu | 29.4 / 4.1 | — | 200 / 200 | HIT → HIT |
| `/en` | şablon tablosu | 4.2 / 3.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler` | şablon tablosu | 87.8 / 17.4 | — | 200 / 200 | - → - |
| `/en/products` | şablon tablosu | 14.4 / 12.6 | — | 200 / 200 | - → - |
| `/tr/cozumler` | şablon tablosu | 13.1 / 12.1 | — | 200 / 200 | - → - |
| `/en/solutions` | şablon tablosu | 10.5 / 10.1 | — | 200 / 200 | - → - |
| `/tr/sirket/hakkimizda` | şablon tablosu | 5.0 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/company/about` | şablon tablosu | 3.1 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/referanslar` | şablon tablosu | 3.3 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/customers` | şablon tablosu | 2.6 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler` | şablon tablosu | 11.6 / 10.1 | — | 200 / 200 | - → - |
| `/en/news` | şablon tablosu | 11.7 / 9.6 | — | 200 / 200 | - → - |
| `/tr/kariyer` | şablon tablosu | 3.5 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/careers` | şablon tablosu | 2.6 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/is-ortaklari` | şablon tablosu | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/partners` | şablon tablosu | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/iletisim` | şablon tablosu | 16.3 / 12.5 | — | 200 / 200 | - → - |
| `/en/contact` | şablon tablosu | 16.9 / 11.7 | — | 200 / 200 | - → - |
| `/tr/destek` | şablon tablosu | 3.7 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support` | şablon tablosu | 2.9 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/indirmeler` | şablon tablosu | 13.5 / 11.8 | — | 200 / 200 | - → - |
| `/en/support/downloads` | şablon tablosu | 10.6 / 11.1 | — | 200 / 200 | - → - |
| `/tr/destek/dokumantasyon` | şablon tablosu | 10.2 / 9.1 | — | 200 / 200 | - → - |
| `/en/support/documentation` | şablon tablosu | 8.9 / 9.0 | — | 200 / 200 | - → - |
| `/tr/destek/surum-notlari` | şablon tablosu | 13.1 / 11.6 | — | 200 / 200 | - → - |
| `/en/support/release-notes` | şablon tablosu | 12.8 / 11.0 | — | 200 / 200 | - → - |
| `/tr/destek/sss` | şablon tablosu | 14.1 / 10.4 | — | 200 / 200 | - → - |
| `/en/support/faq` | şablon tablosu | 12.3 / 10.4 | — | 200 / 200 | - → - |
| `/tr/destek/talep` | şablon tablosu | 11.2 / 11.5 | — | 200 / 200 | - → - |
| `/en/support/request` | şablon tablosu | 10.7 / 13.4 | — | 200 / 200 | - → - |
| `/tr/demo-talep` | şablon tablosu | 14.6 / 12.0 | — | 200 / 200 | - → - |
| `/en/request-demo` | şablon tablosu | 11.0 / 10.2 | — | 200 / 200 | - → - |
| `/tr/teklif-iste` | şablon tablosu | 10.8 / 10.0 | — | 200 / 200 | - → - |
| `/en/request-quote` | şablon tablosu | 10.8 / 12.3 | — | 200 / 200 | - → - |
| `/tr/urunler/akis-yonetimi` | şablon tablosu | 4.6 / 3.0 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi` | şablon tablosu | 3.4 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi` | şablon tablosu | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi` | şablon tablosu | 3.4 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi` | şablon tablosu | 3.1 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi` | şablon tablosu | 2.8 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/surec-otomasyonu` | şablon tablosu | 3.5 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/surec-otomasyonu` | şablon tablosu | 3.3 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/belge-yonetimi` | şablon tablosu | 3.4 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/belge-yonetimi` | şablon tablosu | 3.6 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/kurumsal-raporlama` | şablon tablosu | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/kurumsal-raporlama` | şablon tablosu | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/guvenli-dijital-ortam` | şablon tablosu | 2.8 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/guvenli-dijital-ortam` | şablon tablosu | 3.6 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/ornek-yayin-plani` | şablon tablosu | 4.6 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/news/ornek-yayin-plani` | şablon tablosu | 3.0 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/veri-yonetiminde-ilkeler` | şablon tablosu | 3.2 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/news/veri-yonetiminde-ilkeler` | şablon tablosu | 3.3 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/urun-guncelleme-yaklasimi` | şablon tablosu | 2.9 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/news/urun-guncelleme-yaklasimi` | şablon tablosu | 3.0 / 3.7 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/kvkk-aydinlatma` | şablon tablosu | 4.0 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/legal/kvkk-aydinlatma` | şablon tablosu | 3.5 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/kullanim-kosullari` | şablon tablosu | 3.2 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/kullanim-kosullari` | şablon tablosu | 2.9 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/gizlilik-politikasi` | şablon tablosu | 3.1 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/legal/gizlilik-politikasi` | şablon tablosu | 3.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/eula` | şablon tablosu | 2.9 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/eula` | şablon tablosu | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/cerez-politikasi` | şablon tablosu | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/cerez-politikasi` | şablon tablosu | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/akis-merkezi` | şablon tablosu | 4.0 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/akis-merkezi` | şablon tablosu | 3.7 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/belge-rotasi` | şablon tablosu | 3.1 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/belge-rotasi` | şablon tablosu | 3.3 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/talep-masasi` | şablon tablosu | 3.3 / 3.9 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/talep-masasi` | şablon tablosu | 3.8 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/veri-pusulasi` | şablon tablosu | 3.6 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/veri-pusulasi` | şablon tablosu | 3.6 / 2.9 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/rapor-atolyesi` | şablon tablosu | 3.7 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/rapor-atolyesi` | şablon tablosu | 3.4 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/kalite-izleyici` | şablon tablosu | 3.5 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/kalite-izleyici` | şablon tablosu | 3.4 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi/erisim-kilidi` | şablon tablosu | 3.4 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi/erisim-kilidi` | şablon tablosu | 4.9 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi/sistem-nobeti` | şablon tablosu | 3.6 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi/sistem-nobeti` | şablon tablosu | 5.5 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi` | şablon tablosu | 4.2 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi` | şablon tablosu | 3.0 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi` | şablon tablosu | 3.4 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi` | şablon tablosu | 3.4 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi` | şablon tablosu | 3.0 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi` | şablon tablosu | 3.2 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi` | şablon tablosu | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi` | şablon tablosu | 2.9 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi` | şablon tablosu | 2.8 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi` | şablon tablosu | 2.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici` | şablon tablosu | 2.8 / 5.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici` | şablon tablosu | 4.4 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi` | şablon tablosu | 3.6 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi` | şablon tablosu | 4.4 / 12.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti` | şablon tablosu | 5.6 / 3.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti` | şablon tablosu | 5.0 / 3.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/baslangic` | şablon tablosu | 6.0 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/getting-started` | şablon tablosu | 3.6 / 3.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/kurulum` | şablon tablosu | 4.6 / 2.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/installation` | şablon tablosu | 4.9 / 3.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/yapilandirma` | şablon tablosu | 4.8 / 3.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/configuration` | şablon tablosu | 3.6 / 3.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/baslangic` | şablon tablosu | 5.9 / 3.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/getting-started` | şablon tablosu | 3.9 / 3.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/kurulum` | şablon tablosu | 4.9 / 3.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/installation` | şablon tablosu | 6.5 / 3.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/yapilandirma` | şablon tablosu | 7.7 / 4.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/configuration` | şablon tablosu | 3.6 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/baslangic` | şablon tablosu | 3.4 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/getting-started` | şablon tablosu | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/kurulum` | şablon tablosu | 3.0 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/installation` | şablon tablosu | 3.2 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/yapilandirma` | şablon tablosu | 2.8 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/configuration` | şablon tablosu | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/baslangic` | şablon tablosu | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/getting-started` | şablon tablosu | 5.5 / 4.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/kurulum` | şablon tablosu | 5.8 / 4.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/installation` | şablon tablosu | 5.0 / 5.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/yapilandirma` | şablon tablosu | 7.2 / 7.7 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/configuration` | şablon tablosu | 4.6 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/baslangic` | şablon tablosu | 3.5 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/getting-started` | şablon tablosu | 3.6 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/kurulum` | şablon tablosu | 3.5 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/installation` | şablon tablosu | 3.8 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/yapilandirma` | şablon tablosu | 3.3 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/configuration` | şablon tablosu | 3.8 / 4.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/baslangic` | şablon tablosu | 3.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/getting-started` | şablon tablosu | 3.3 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/kurulum` | şablon tablosu | 3.2 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/installation` | şablon tablosu | 3.1 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/yapilandirma` | şablon tablosu | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/configuration` | şablon tablosu | 2.9 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/baslangic` | şablon tablosu | 3.4 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/getting-started` | şablon tablosu | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/kurulum` | şablon tablosu | 2.9 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/installation` | şablon tablosu | 2.8 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/yapilandirma` | şablon tablosu | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/configuration` | şablon tablosu | 2.9 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/baslangic` | şablon tablosu | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/getting-started` | şablon tablosu | 2.8 / 1.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/kurulum` | şablon tablosu | 2.8 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/installation` | şablon tablosu | 2.7 / 1.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/yapilandirma` | şablon tablosu | 2.6 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/configuration` | şablon tablosu | 4.0 / 2.5 | — | 200 / 200 | HIT → HIT |

## Build koşuları

1. 68.86 sn: `/500` prerender sırasında `<Html> should not be imported outside of pages/_document` hatasıyla başarısız; dokümantasyon timeout kanıtı yok.
2. 59.33 sn: başarılı.
3. 36.70 sn: başarılı.

Sorgu zamanlaması ve kilit telemetrisi bulunmadığından timeout'un kök nedeni belirlenemedi. Sayfa başına SQLite sayacı ve testleri henüz uygulanmadı; kilit/loader hipotezlerini ölçmek için bunlarla tekrarlanması gerekir. Build sırasında 3100 kapatılmadığı için dev açık/kapalı karşılaştırması yapılmadı.

## F1 ara ölçümü (2026-11-07)

| Ölçüm | F0 önce | F1 sonra |
|---|---:|---:|
| Ana sayfa First Load JS (Next build) | 135 kB | 135 kB |
| İstek başına SQLite sorgusu | ölçülmedi | ölçülmedi |

SQLite çevrimiçi yedeğiyle, aynı DB dosyasına başka süreç erişmeden üç `.next-perf` build başarılı: 33/37/33 sn. Salt-okuma yükü altındaki ilk deneme, paralel kod değişikliği sırasında eksik `reveal` modülü nedeniyle derleme aşamasında durdu. Aynı yedekte 5 ms aralıkla ürün sayısı okuyan ayrı bir SQLite bağlantısıyla tekrar edilen build 32 sn’de başarılı oldu. 3100 açık kaldı. SQLite WAL ve 5000 ms busy timeout zaten yapılandırılmıştır. `/500` ve doküman timeout kök nedeni doğrulanmamıştır; query logger henüz tamamlanmamıştır. Bu salt-okuma deneyi yazma kilidini veya üretimdeki diğer iş yüklerini temsil etmez. `motion` uygulama kodunda kullanılmıyordu; kaldırılması tek başına JS boyutunda düşüş anlamına gelmez.
