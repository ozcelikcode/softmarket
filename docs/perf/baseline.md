# F0 performance measurement — 2026-11-07

Measurement was planned with isolated `NEXT_DIST_DIR=.next-perf`, `PORT=3300`. Neither a browser nor the 3100 dev server was used. First Load JS is from the second build output, per route template. An SSG label alone is not proof of an ISR HIT. Results show only directly observable data; `—` means not measured.

| Route | First Load JS | TTFB first/second | SQLite queries | ISR |
|---|---:|---:|---:|---|
| `/[locale]` | 135 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/ara` | 129 kB | — | — | dynamic |
| `/[locale]/arama` | 114 kB | — | — | dynamic |
| `/[locale]/cozumler` | 135 kB | — | — | dynamic |
| `/[locale]/cozumler/[slug]` | 146 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/demo-talep` | 136 kB | — | — | dynamic |
| `/[locale]/destek` | 129 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/destek/dokumantasyon` | 129 kB | — | — | dynamic |
| `/[locale]/destek/dokumantasyon/[product]` | 130 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/destek/dokumantasyon/[product]/[slug]` | 130 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/destek/iletisim` | 136 kB | — | — | dynamic |
| `/[locale]/destek/indirmeler` | 129 kB | — | — | dynamic |
| `/[locale]/destek/sss` | 140 kB | — | — | dynamic |
| `/[locale]/destek/surum-notlari` | 129 kB | — | — | dynamic |
| `/[locale]/destek/talep` | 136 kB | — | — | dynamic |
| `/[locale]/haberler` | 135 kB | — | — | dynamic |
| `/[locale]/haberler/[slug]` | 135 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/iletisim` | 136 kB | — | — | dynamic |
| `/[locale]/is-ortaklari` | 135 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/kariyer` | 129 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/kariyer/[slug]` | 130 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/referanslar` | 135 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/referanslar/[slug]` | 146 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/sirket/hakkimizda` | 146 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/teklif-iste` | 136 kB | — | — | dynamic |
| `/[locale]/urunler` | 135 kB | — | — | dynamic |
| `/[locale]/urunler/[family]` | 135 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/urunler/[family]/[product]` | 146 kB | — | — | SSG, 1h only those listed in build output |
| `/[locale]/yasal/[slug]` | 146 kB | — | — | SSG, 1h only those listed in build output |

## Documentation build timeout investigation

For `/[locale]/destek/dokumantasyon/[product]`, both metadata and page call `load`; `getSupportProducts` is wrapped with React `cache()`. `supportVariants` is called separately from metadata and page and performs an uncached `products.findByID`. `getDocTree` also uses `cache()` and queries docs with selected fields after product validation. `contentStaticParams` uses sitemap data for each template; although `entries` is wrapped with React `cache()`, sharing across separate build workers is not guaranteed. These are duplication possibilities observed in code; they are not verified as the cause of the 60-second timeout.

SQLite uses WAL, `busyTimeout: 5000`, and `transactionOptions.behavior: immediate`. `revalidatePublicContent` returns early during the production build phase; hooks are called only on mutation/delete operations. Lock waits or concurrent writes were not measured in these runs, so they can neither be confirmed nor ruled out.


## HTTP measurements

After the third build, 144 URLs in the sitemap were measured sequentially with two GETs on port 3300. Pre-generated pages may return HIT on the first request; therefore the first/second columns are not labeled MISS/HIT and do not substitute for a post-publish invalidation test. First Load JS route templates are in the table above; cells for query count are empty because the query counter was not yet implemented.

| URL | First Load JS | TTFB first / second (ms) | Queries | HTTP first / second | Cache first → second |
|---|---:|---:|---:|---|---|
| `/tr` | template table | 29.4 / 4.1 | — | 200 / 200 | HIT → HIT |
| `/en` | template table | 4.2 / 3.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler` | template table | 87.8 / 17.4 | — | 200 / 200 | - → - |
| `/en/products` | template table | 14.4 / 12.6 | — | 200 / 200 | - → - |
| `/tr/cozumler` | template table | 13.1 / 12.1 | — | 200 / 200 | - → - |
| `/en/solutions` | template table | 10.5 / 10.1 | — | 200 / 200 | - → - |
| `/tr/sirket/hakkimizda` | template table | 5.0 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/company/about` | template table | 3.1 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/referanslar` | template table | 3.3 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/customers` | template table | 2.6 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler` | template table | 11.6 / 10.1 | — | 200 / 200 | - → - |
| `/en/news` | template table | 11.7 / 9.6 | — | 200 / 200 | - → - |
| `/tr/kariyer` | template table | 3.5 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/careers` | template table | 2.6 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/is-ortaklari` | template table | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/partners` | template table | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/iletisim` | template table | 16.3 / 12.5 | — | 200 / 200 | - → - |
| `/en/contact` | template table | 16.9 / 11.7 | — | 200 / 200 | - → - |
| `/tr/destek` | template table | 3.7 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support` | template table | 2.9 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/indirmeler` | template table | 13.5 / 11.8 | — | 200 / 200 | - → - |
| `/en/support/downloads` | template table | 10.6 / 11.1 | — | 200 / 200 | - → - |
| `/tr/destek/dokumantasyon` | template table | 10.2 / 9.1 | — | 200 / 200 | - → - |
| `/en/support/documentation` | template table | 8.9 / 9.0 | — | 200 / 200 | - → - |
| `/tr/destek/surum-notlari` | template table | 13.1 / 11.6 | — | 200 / 200 | - → - |
| `/en/support/release-notes` | template table | 12.8 / 11.0 | — | 200 / 200 | - → - |
| `/tr/destek/sss` | template table | 14.1 / 10.4 | — | 200 / 200 | - → - |
| `/en/support/faq` | template table | 12.3 / 10.4 | — | 200 / 200 | - → - |
| `/tr/destek/talep` | template table | 11.2 / 11.5 | — | 200 / 200 | - → - |
| `/en/support/request` | template table | 10.7 / 13.4 | — | 200 / 200 | - → - |
| `/tr/demo-talep` | template table | 14.6 / 12.0 | — | 200 / 200 | - → - |
| `/en/request-demo` | template table | 11.0 / 10.2 | — | 200 / 200 | - → - |
| `/tr/teklif-iste` | template table | 10.8 / 10.0 | — | 200 / 200 | - → - |
| `/en/request-quote` | template table | 10.8 / 12.3 | — | 200 / 200 | - → - |
| `/tr/urunler/akis-yonetimi` | template table | 4.6 / 3.0 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi` | template table | 3.4 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi` | template table | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi` | template table | 3.4 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi` | template table | 3.1 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi` | template table | 2.8 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/surec-otomasyonu` | template table | 3.5 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/surec-otomasyonu` | template table | 3.3 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/belge-yonetimi` | template table | 3.4 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/belge-yonetimi` | template table | 3.6 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/kurumsal-raporlama` | template table | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/kurumsal-raporlama` | template table | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/cozumler/guvenli-dijital-ortam` | template table | 2.8 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/solutions/guvenli-dijital-ortam` | template table | 3.6 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/ornek-yayin-plani` | template table | 4.6 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/news/ornek-yayin-plani` | template table | 3.0 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/veri-yonetiminde-ilkeler` | template table | 3.2 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/news/veri-yonetiminde-ilkeler` | template table | 3.3 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/haberler/urun-guncelleme-yaklasimi` | template table | 2.9 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/news/urun-guncelleme-yaklasimi` | template table | 3.0 / 3.7 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/kvkk-aydinlatma` | template table | 4.0 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/legal/kvkk-aydinlatma` | template table | 3.5 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/kullanim-kosullari` | template table | 3.2 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/kullanim-kosullari` | template table | 2.9 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/gizlilik-politikasi` | template table | 3.1 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/legal/gizlilik-politikasi` | template table | 3.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/eula` | template table | 2.9 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/eula` | template table | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/yasal/cerez-politikasi` | template table | 3.0 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/legal/cerez-politikasi` | template table | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/akis-merkezi` | template table | 4.0 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/akis-merkezi` | template table | 3.7 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/belge-rotasi` | template table | 3.1 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/belge-rotasi` | template table | 3.3 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/akis-yonetimi/talep-masasi` | template table | 3.3 / 3.9 | — | 200 / 200 | HIT → HIT |
| `/en/products/akis-yonetimi/talep-masasi` | template table | 3.8 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/veri-pusulasi` | template table | 3.6 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/veri-pusulasi` | template table | 3.6 / 2.9 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/rapor-atolyesi` | template table | 3.7 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/rapor-atolyesi` | template table | 3.4 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/veri-zekasi/kalite-izleyici` | template table | 3.5 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/products/veri-zekasi/kalite-izleyici` | template table | 3.4 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi/erisim-kilidi` | template table | 3.4 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi/erisim-kilidi` | template table | 4.9 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/urunler/guvenli-altyapi/sistem-nobeti` | template table | 3.6 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/products/guvenli-altyapi/sistem-nobeti` | template table | 5.5 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi` | template table | 4.2 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi` | template table | 3.0 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi` | template table | 3.4 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi` | template table | 3.4 / 2.4 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi` | template table | 3.0 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi` | template table | 3.2 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi` | template table | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi` | template table | 2.9 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi` | template table | 2.8 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi` | template table | 2.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici` | template table | 2.8 / 5.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici` | template table | 4.4 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi` | template table | 3.6 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi` | template table | 4.4 / 12.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti` | template table | 5.6 / 3.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti` | template table | 5.0 / 3.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/baslangic` | template table | 6.0 / 2.7 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/getting-started` | template table | 3.6 / 3.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/kurulum` | template table | 4.6 / 2.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/installation` | template table | 4.9 / 3.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/akis-merkezi/yapilandirma` | template table | 4.8 / 3.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/akis-merkezi/configuration` | template table | 3.6 / 3.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/baslangic` | template table | 5.9 / 3.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/getting-started` | template table | 3.9 / 3.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/kurulum` | template table | 4.9 / 3.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/installation` | template table | 6.5 / 3.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/belge-rotasi/yapilandirma` | template table | 7.7 / 4.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/belge-rotasi/configuration` | template table | 3.6 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/baslangic` | template table | 3.4 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/getting-started` | template table | 3.3 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/kurulum` | template table | 3.0 / 2.3 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/installation` | template table | 3.2 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/talep-masasi/yapilandirma` | template table | 2.8 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/talep-masasi/configuration` | template table | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/baslangic` | template table | 3.1 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/getting-started` | template table | 5.5 / 4.3 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/kurulum` | template table | 5.8 / 4.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/installation` | template table | 5.0 / 5.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/veri-pusulasi/yapilandirma` | template table | 7.2 / 7.7 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/veri-pusulasi/configuration` | template table | 4.6 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/baslangic` | template table | 3.5 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/getting-started` | template table | 3.6 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/kurulum` | template table | 3.5 / 2.6 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/installation` | template table | 3.8 / 2.5 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/rapor-atolyesi/yapilandirma` | template table | 3.3 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/rapor-atolyesi/configuration` | template table | 3.8 / 4.2 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/baslangic` | template table | 3.8 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/getting-started` | template table | 3.3 / 2.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/kurulum` | template table | 3.2 / 2.2 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/installation` | template table | 3.1 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/kalite-izleyici/yapilandirma` | template table | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/kalite-izleyici/configuration` | template table | 2.9 / 3.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/baslangic` | template table | 3.4 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/getting-started` | template table | 3.0 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/kurulum` | template table | 2.9 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/installation` | template table | 2.8 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/erisim-kilidi/yapilandirma` | template table | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/erisim-kilidi/configuration` | template table | 2.9 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/baslangic` | template table | 2.7 / 1.9 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/getting-started` | template table | 2.8 / 1.8 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/kurulum` | template table | 2.8 / 2.0 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/installation` | template table | 2.7 / 1.7 | — | 200 / 200 | HIT → HIT |
| `/tr/destek/dokumantasyon/sistem-nobeti/yapilandirma` | template table | 2.6 / 2.1 | — | 200 / 200 | HIT → HIT |
| `/en/support/documentation/sistem-nobeti/configuration` | template table | 4.0 / 2.5 | — | 200 / 200 | HIT → HIT |

## Build runs

1. 68.86 s: failed during `/500` prerender with `<Html> should not be imported outside of pages/_document`; no evidence of documentation timeout.
2. 59.33 s: succeeded.
3. 36.70 s: succeeded.

Because query timing and lock telemetry were unavailable, the root cause of the timeout could not be determined. Per-page SQLite counter and tests have not yet been implemented; they must be re-run with those in place to measure lock/loader hypotheses. Because 3100 was not shut down during the build, a dev on/off comparison was not made.

## F1 interim measurement (2026-11-07)

| Metric | F0 before | F1 after |
|---|---:|---:|
| Home page First Load JS (Next build) | 135 kB | 135 kB |
| SQLite queries per request | not measured | not measured |

With an online SQLite backup and no other process accessing the same DB file, three `.next-perf` builds succeeded: 33/37/33 s. The first attempt under read-only load stopped at compile time due to a missing `reveal` module during a parallel code change. A repeated build on the same backup with a separate SQLite connection reading product count every 5 ms succeeded in 32 s. 3100 remained open. SQLite WAL and 5000 ms busy timeout are already configured. The `/500` and documentation timeout root causes are not verified; the query logger is not yet complete. This read-only experiment does not represent write locking or other production workloads. `motion` was not used in application code; removing it does not by itself imply a reduction in JS size.

## Query count — 2026-11-07

`NEXT_DIST_DIR=.next-perf pnpm build` succeeded. Then measured on local SQLite with `SM_DB_QUERY_LOG=1 PORT=3300 NEXT_DIST_DIR=.next-perf pnpm start`. Server stdout was redirected to `/tmp/softmarket-db-server.log`; `SM_DB_QUERY_LOG_FILE=/tmp/softmarket-db-server.log pnpm exec tsx scripts/perf-isr.ts http://127.0.0.1:3300` was run. The script adds search and portal login to the 144 URLs in the sitemap and performs two sequential GETs per route. All 292 responses were HTTP 200.

The counter wraps the libSQL client inside `payload.config.ts` before Drizzle captures it, only when `SM_DB_QUERY_LOG=1`. Node instrumentation opens an `AsyncLocalStorage` context at HTTP entry; no middleware is used, and `getDbQueryStats()` can read a snapshot during server render. `execute`, statements inside `batch`/`migrate`, and transaction `begin`/`commit`/`rollback` operations are counted; failing calls are also included. Duration is the sum of elapsed time of client calls (not pure SQLite CPU time). SQL/parameters/cookies/query values are not logged.

Because headers may flush early during response streaming, final counts are written to a `SM_DB_QUERY` JSON line on the `finish` event. The script correlates them via a random `x-sm-perf-id` request ID; a missing log is not treated as 0. When the flag is off, the adapter/client and HTTP emit are not wrapped, no ALS is created, and no extra per-query code runs. In production it is also enabled only with the explicit flag. This measurement is for Node HTTP/1 `pnpm start`; background work after response completion is not included.

Top 10 query-producing routes, ordered by the higher count of the two requests (ties in measurement order):

| Route | Queries first / second | SQL total ms first / second | Cache first → second |
|---|---:|---:|---|
| `/tr/ara?q=akis` | 33 / 33 | 4.525 / 3.477 | - → - |
| `/tr/urunler` | 17 / 14 | 14.033 / 2.513 | - → - |
| `/tr/iletisim` | 16 / 16 | 4.646 / 2.338 | - → - |
| `/en/contact` | 16 / 16 | 2.281 / 2.14 | - → - |
| `/tr/destek/indirmeler` | 16 / 16 | 3.811 / 2.386 | - → - |
| `/en/support/downloads` | 16 / 16 | 2.09 / 2.058 | - → - |
| `/tr/destek/talep` | 15 / 15 | 2.874 / 2.862 | - → - |
| `/en/support/request` | 15 / 15 | 2.867 / 2.802 | - → - |
| `/tr/demo-talep` | 15 / 15 | 2.772 / 3.19 | - → - |
| `/en/request-demo` | 15 / 15 | 2.879 / 2.8 | - → - |

`/tr/urunler` produced 17 queries on the first dynamic request and 14 on the second; the first request count also includes three `PRAGMA` calls on client open. Thus the first column may include cold-start cost. `/tr/ara?q=akis`: 33/33; `/tr/destek/indirmeler`: 16/16; `/tr/iletisim`: 16/16; `/tr/hesap/giris`: 9/9 (1.260/1.239 ms).

**0/0 queries, 0/0 ms** was verified across all 122 ISR HIT/HIT route pairs (244 responses). The remaining 24 routes are dynamic; not labeled MISS. No new content was written or revalidation triggered; the dynamic pages above were used for uncached renders. During concurrent search, portal login, and catalog GETs, the separate counters stayed **33/9/14**. The 3300 measurement server was shut down; the 3100 dev process was untouched.

Unit tests: client/adapter/HTTP emit identity is preserved when the flag is off; when on, adapter's new client assignment is captured, method receiver is preserved, and batch/transaction/error counting, double-wrapping guard, duration, and concurrent context isolation are verified. "Not measured" statements in earlier sections belong to old F0/F1 runs; this table completes the query measurement.

Latest verification: `pnpm typecheck`, `pnpm lint`, `pnpm test` (32 files / 376 tests), and `git diff --check` passed. Isolated production build succeeded; no process listening on 3300 after measurement. No commit was created.
