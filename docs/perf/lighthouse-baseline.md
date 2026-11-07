# Lighthouse baseline (F0, 2026-11-07)

Ortam: `NEXT_DIST_DIR=.next-prod pnpm build` + `next start` (127.0.0.1:3200), yerel SQLite, ISR önbelleği sıcak. Lighthouse 13.6.0 (`pnpm exec lighthouse`), Chrome for Testing 1248 (playwright), mobil = varsayılan simüle throttling, masaüstü = `--preset=desktop`. Koşu sayısı: 1 (medyan yok). Ham sonuç: `docs/perf/lighthouse-baseline.json`.
Yeniden üretme: sunucuyu aç, `CHROME_PATH=<chrome> node scripts/perf-lighthouse.mjs` (URL/bütçe listesi `lighthouserc.json`). Sandbox/MachPort sorunu çıkmadı; `--no-sandbox` ile çalıştı.

Bütçe (plan §7): LCP < 2.0 s, CLS < 0.05, TBT < 150 ms, Perf ≥ 90, A11y/SEO/BP ≥ 95, JS gzip ≤ 130 KB.


### Mobil

| Sayfa | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | TTFB (ms) | JS gzip (KB) | JS ham (KB) | LCP elemanı |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ana sayfa TR (`/tr`) | 92 | 100 | 100 | 92 | 1.12 | 0.000 | 323 | 5 | 193 | 579 | `section.relative > div.mx-auto > div > h1.text-balance "Karmaşık işler için sade yazılım."` |
| Ana sayfa EN (`/en`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 10 | 2 | 193 | 579 | `section.relative > div.mx-auto > div > h1.text-balance "Simple software for complex work."` |
| Ürün listesi (`/tr/urunler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 7 | 31 | 200 | 595 | `section.relative > div.mx-auto > div > p.mt-5 "Ürün ailelerimizi ve ailelerin altındaki"` |
| Ürün detayı (`/tr/urunler/akis-yonetimi/akis-merkezi`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 8 | 2 | 200 | 596 | `div#genel-bakis > section.relative > div.mx-auto > p.text-h3 "Akışları tek noktadan tasarlayın ve izle"` |
| Çözümler (`/tr/cozumler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 12 | 12 | 200 | 595 | `section.relative > div.mx-auto > div > p.mt-5 "Sektör ve kullanım senaryolarına göre ha"` |
| Destek (`/tr/destek`) | 100 | 100 | 100 | 92 | 1.06 | 0.000 | 6 | 2 | 194 | 580 | `section.relative > div.mx-auto > div > p.mt-5 "Yazılımınız için dokümanları, güncelleme"` |
| Haberler (`/tr/haberler`) | 100 | 100 | 100 | 92 | 1.21 | 0.000 | 14 | 12 | 195 | 583 | `section.relative > div.mx-auto > div > p.mt-5 "Duyurular, ürün güncellemeleri ve yazıla"` |

### Masaüstü

| Sayfa | Perf | A11y | BP | SEO | LCP (s) | CLS | TBT (ms) | TTFB (ms) | JS gzip (KB) | JS ham (KB) | LCP elemanı |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Ana sayfa TR (`/tr`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 1 | 197 | 586 | `section.relative > div.mx-auto > div > h1.text-balance "Karmaşık işler için sade yazılım."` |
| Ana sayfa EN (`/en`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 197 | 586 | `section.relative > div.mx-auto > div > h1.text-balance "Simple software for complex work."` |
| Ürün listesi (`/tr/urunler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 13 | 205 | 602 | `section.relative > div.mx-auto > div > h1.text-balance "Ürünler"` |
| Ürün detayı (`/tr/urunler/akis-yonetimi/akis-merkezi`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 205 | 603 | `section.relative > div.mx-auto > div > h1.text-balance "Akış Merkezi"` |
| Çözümler (`/tr/cozumler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 11 | 205 | 602 | `section.relative > div.mx-auto > div > h1.text-balance "Çözümler"` |
| Destek (`/tr/destek`) | 100 | 100 | 100 | 92 | 0.29 | 0.000 | 0 | 2 | 208 | 610 | `section.relative > div.mx-auto > div > h1.text-balance "Destek merkezi"` |
| Haberler (`/tr/haberler`) | 100 | 100 | 100 | 92 | 0.33 | 0.000 | 0 | 11 | 214 | 621 | `section.relative > div.mx-auto > div > h1.text-balance "Haberler"` |

INP: lab koşusunda ölçülmez (TBT vekil). Playwright vitals F0 sonrası kalemidir.

## Okuma

- Mobil Perf 100 / A11y 100 / BP 100; SEO 92. LCP 1.05-1.21 s, CLS 0. Bütçe LCP/CLS/TBT için sağlanıyor.
- İlk koşu (`/tr` mobil) soğuk önbellek aykırı değeri: Perf 92, TBT 323 ms, LCP elemanı render gecikmesi 882 ms. Ardışık 2 yeniden koşu: Perf 100, TBT 9-10 ms, LCP 1.05 s. Bu yüzden F2'de "ilk yük" davranışı ayrıca ölçülmeli.
- **JS gzip 193-214 KB, bütçe 130 KB'ı aşıyor** (tüm sayfalarda). Next "First Load JS shared" = 102 KB; sayfa başına toplam 135-146 KB (build çıktısı). Lighthouse toplamı hydration sonrası tüm istenen script'leri sayar (kullanılmayan `motion` bağımlılığı ve her blok için ayrı client `Reveal` adaları şüpheli; bundle analizi F0 kalemi). F1: `motion` kaldırma + `Reveal` adaları.
- SEO 92 nedeni: `canonical` denetimi. Prod build'de `NEXT_PUBLIC_SERVER_URL` yerel origin (`http://127.0.0.1:3100`), build uyarısı da bunu söylüyor. Alan adı verilince düşer; kod hatası değil.
- Başarısız denetimler: `canonical` (tümü), `bf-cache` (liste sayfaları /urunler, /cozumler, /haberler; geri-ileri önbelleği engeli, nedeni F1'de incelenmeli).
- Mobil LCP elemanı: ana sayfada hero `h1` (metin; görsel yok), alt sayfalarda hero lead paragrafı (`p.mt-5`), ürün detayında `p.text-h3` (genel bakış). Hero görseli yok, görsel bütçesi bu fazda ölçülemez.
- En kötü sayfa (mobil): ana sayfa ilk koşu 92; kararlı durumda hepsi 100. Gerçek darboğaz JS boyutu ve render-blocking CSS (render-blocking-insight: tahmini 360 ms kazanç).
