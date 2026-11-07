# Görsel QA baseline (F0, 2026-11-07)

Kapsam: sitemap.xml'deki 144 public URL (TR+EN) x 390/768/1440 = 432 tam sayfa ekran görüntüsü (prod build, 127.0.0.1:3200, sayfa sonuna kadar kaydırılıp reveal tetiklendi).
Ekran görüntüleri: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/visual/` (dosya adı: `<yol, / yerine __>--<genişlik>.png`, örn. `tr__urunler__akis-yonetimi__akis-merkezi--1440.png`). Etkileşim görüntüleri aynı dizinin üst klasöründe: `ix-*.png` (`.../scratchpad/ix-mobile-menu-390.png`, `ix-mega-1440.png`, `ix-focus-1440.png`, `ix-teklif-top-1440.png`).
Yeniden üretme: `node scripts/qa-screenshots.mjs <urls.txt> <outDir> [baseUrl]` (aynı çalıştırma `probe.json` üretir).

Otomatik yoklama (432 görüntünün tamamı): HTTP 200 hepsi; konsol hatası 0; kırık görsel 0; sayfa başına belge taşması 0; CLS > 0.02 olan sayfa 0; takılı gizli reveal öğesi 0; JS kapalıyken opacity:0 öğe 0. Yatay kırpılma (belge taşması olmadan, `overflow-x` ile gizlenen) yalnız aşağıdaki K1 ve Y6'da var.
Not: Sadece TR sayfaları göz ile incelendi (TR ve EN aynı bileşenleri kullanır); 1440 için tüm sayfa tipleri, 390 için ana sayfa, ürün detayı, iletişim, destek, SSS, 768 için otomatik yoklama bakıldı. 768 görüntüleri tek tek incelenmedi.

## Kritik

| # | Sayfa / genişlik | Sorun | Öneri | Görüntü |
|---|---|---|---|---|
| K1 | `/tr`, `/en` · 390 | Hero lead paragrafı ve sağdaki "Ürün aileleri" paneli sağdan kırpılıyor ("güvenle", "kurulumu hızlı, yö..." kesik; panel kartları ekran dışına taşıyor). Belge taşması ölçümünde görünmüyor çünkü kırpma gizli. Neden: grid çocuğu `min-width:auto` (boş class'lı DIV 390 px'i aşıyor). | Grid çocuğuna `min-w-0`, panel `w-full max-w-full`; lead `break-words`. | `tr--390.png`, `en--390.png` |
| K2 | `/tr/teklif-iste`, `/tr/demo-talep`, `/en/request-quote`, `/en/request-demo` · 1440 (mobilde header ayrı kontrol edilmeli) | Header şeffaf ve metin rengi açık (rgb 231,233,236) ama hero açık zeminli: logo "SoftMarket" neredeyse görünmüyor, menü öğeleri düşük kontrastlı. Destek sayfaları doğru (koyu metin). Ana dönüşüm sayfaları olduğu için kritik. | Header tema kararını sayfanın hero temasından türet (hero `light` ise koyu metin) ya da bu sayfalara koyu hero ver; `data-header-theme` benzeri tek kaynak. | `tr__teklif-iste--1440.png`, `ix-teklif-top-1440.png` |

## Yüksek

| # | Sayfa / genişlik | Sorun | Öneri | Görüntü |
|---|---|---|---|---|
| Y1 | `/tr/iletisim`, `/en/contact` · tüm | Ham yer tutucular görünür: `[ŞİRKET ADRESİ]`, `[COMPANY PHONE]`, `[ÇALIŞMA SAATLERİ]`. | Gerçek veri girilene kadar kartı gizle ya da SiteSettings boşsa render etme. | `tr__iletisim--1440.png`, `tr__iletisim--390.png` |
| Y2 | Tüm sayfalar · tüm | Marka tutarsız: header "SoftMarket", footer ve ana sayfa "Örnek Kurumsal Yazılım" ("— demo içerik" telif satırı). | Tek kaynak (SiteSettings.siteName + logo); "demo içerik" ifadesini canlıda kaldır. | `tr--1440.png` (footer), `tr--390.png` |
| Y3 | `/tr/sirket/hakkimizda`, `/tr/referanslar`, `/tr/kariyer`, `/tr/is-ortaklari` · 1440 | Boş durum kartları ("İçerik hazırlanıyor", "Vaka çalışmaları yakında", "Ortak listesi yakında") menüde ve footer'da yayında; sayfa boşluğu ~600 px, CTA yok. | Boş durumları sayfa kurucu blokla doldur ya da menüden çıkar; boş durum kartına CTA (iletişim) ekle. | `tr__sirket__hakkimizda--1440.png`, `tr__referanslar--1440.png`, `tr__kariyer--1440.png` |
| Y4 | `/tr/haberler`, ana sayfa haberler bölümü · tüm | Haber kartlarında görsel yok; gri boş alan (~140 px) kartın yarısı, rozet gri zemin üstünde kayboluyor. | Görseli yoksa kapak alanını kaldır ya da markalı yer tutucu (gradient + ikon) kullan. | `tr__haberler--1440.png`, `tr--1440.png` |
| Y5 | `/tr/urunler/*/*` (ürün detayı) · 1440 | Bölüm hizası tutarsız: genel bakış paragrafı ve SSS ~600 px dar ve ortada; Özellikler/Teknik/Sürümler tam kapsayıcıda sola dayalı; sistem gereksinimleri kartı 1/2 genişlik. Aynı sayfada üç farklı sütun ızgarası. | Tek kapsayıcı genişliği + açık "narrow" varyantı kuralı; gereksinim kartı tam genişlik. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |
| Y6 | `/tr/urunler/*/*` · 390 | Alt gezinme sekmeleri (Genel Bakış...Dokümantasyon) sağda "Sü" diye kesiliyor; kaydırılabilir olduğu belli değil (gölge/ok yok). Breadcrumb 2 satıra kırılıp "Akış Merkezi" tek başına alt satırda. | Sekme şeridine sağ fade/gölge, aktif sekmeyi görünür kaydır; breadcrumb'ı tek satır kes (`truncate`) ya da yalnız üst seviyeyi göster. | `tr__urunler__akis-yonetimi__akis-merkezi--390.png` |
| Y7 | `/tr/urunler/*/*` · 1440 | Ürün özellik ızgarası (4 öğe, 3 sütun): son satırdaki 2 boş hücre gri dolgulu "delik" gibi görünüyor. | Boş hücreleri doldurma (`gap`+kart), ya da sütun sayısını öğe sayısına göre (2/4) seç. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |
| Y8 | `/tr/urunler/*/*` · 1440 | Bölüm ritmi: koyu CTA bandı hemen ardından koyu "Sürümler" bölümü (iki koyu blok yan yana, ince çizgi ile). CTA bandında buton yok (başlık+metin var, eylem yok). | Sürümler'i açık zemine al ya da CTA'yı Sürümler sonrasına koy; CTA'ya "Teklif İste" butonu. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |

## Orta

| # | Sayfa / genişlik | Sorun | Öneri | Görüntü |
|---|---|---|---|---|
| O1 | Tüm sayfalar · 1440 | Kapsayıcı kenarları üç farklı: header/footer ve ana sayfa hero'su ~72 px'ten, sayfa içeriği/breadcrumb/başlık ~152 px'ten başlar; ana sayfada hero ile altındaki bölümler (152 px) hizasız. | Tek `--container` (örn. 1200) tüm bölümlerde; hero dahil. | `tr--1440.png`, `tr__urunler--1440.png` |
| O2 | `/tr/destek`, `/tr/destek/*` · 1440 | Destek ve alt sayfalar açık hero, diğer tüm sayfalar koyu hero: tema geçişi tutarsız. Üstelik hero alt kenarı çizgisiz, gradient bulanık leke gibi. | Hero teması için tek kural (başlık sayfası = koyu). | `tr__destek--1440.png`, `tr__destek__sss--1440.png` |
| O3 | `/tr/destek` · 1440 | Arama alanı (Ara düğmesi x=~511) ile Ürün seçicisi (Uygula x=~715) farklı genişlikte; iki form satırı hizasız. Arama girişinin placeholder'ı yok. | İki satırı aynı grid'e koy; placeholder ekle. | `tr__destek--1440.png` |
| O4 | `/tr/destek/surum-notlari` · 1440 | Tipografi hiyerarşisi ters: küçük "1.1.0 — Örnek bakım ve iyileştirme sürümü" satırı üstte, altında daha büyük "Bakım ve iyileştirme" başlığı; 8 kartta aynı başlık tekrar eder, sayfa ~6000 px. | Sürüm numarası + tarih büyük başlık; özet metni gövde; sayfalama/daraltma. | `tr__destek__surum-notlari--1440.png` |
| O5 | `/tr/cozumler/*` · 1440 | Çözüm detayı iskelet: yalnız "İlgili ürünler" (2 kart sol 2/3), ~600 px hero + boş alt; CTA yok. Ana sayfadaki çözüm kartları üç yerde aynı jenerik metni içerir ("X için yazılım bileşenlerini birlikte değerlendiren örnek çözüm"). | Çözüm sayfasına problem/fayda blokları ve CTA; kart özetlerini farklılaştır. | `tr__cozumler__surec-otomasyonu--1440.png`, `tr--1440.png` |
| O6 | Ürün/çözüm/ürün listesi · 1440 | Son satırda öksüz kart (8 üründe 3+3+2; 2 sürüm kartı sol 2/3) sağda boşluk bırakır. Kartların tek eylemi küçük ok ikonu; tıklanabilirlik ipucu zayıf. | `auto-fit` ızgara + ortalama, kartta "İncele" metin bağlantısı. | `tr__urunler--1440.png` |
| O7 | `/tr/iletisim`, `/tr/teklif-iste` · 1440 | Formlarda zorunlu alan işareti yok, giriş alanları zemine yakın (border kontrastı düşük); gönder düğmesi sola dayalı küçük. | Zorunlu `*`, border kontrastı ≥ 3:1, düğmeyi tam sütun. | `tr__iletisim--1440.png`, `tr__teklif-iste--1440.png` |
| O8 | Mobil menü · 390 | Açık menüde logo yok (yalnız kapat düğmesi), alt-menü öğeleri (Ürünler/Çözümler/Şirket) kapalı gelir, panelin solunda sayfadan ince şerit görünüyor; ortada büyük boş alan. | Panele logo, tam genişlik, alt linkleri aç/kapa animasyonuyla göster. | `ix-mobile-menu-390.png` |

## Düşük

| # | Sayfa / genişlik | Sorun | Öneri | Görüntü |
|---|---|---|---|---|
| D1 | Header mega menü · 1440 | İçerik soldan 3 sütun, sağ ~%25 boş; "Tüm ürünler" bağlantısı küçük. | Sütunları ortala/dağıt; sağa öne çıkan kart. | `ix-mega-1440.png` |
| D2 | Tüm sayfalar · 1440 | Odak halkası görünür (iyi) fakat yalnız menü düğmesinde test edildi; kart bağlantıları ve form alanlarında ayrıca doğrulanmalı. Atla bağlantısı (`#main`) 24 px altı hedef (sr-only, beklenen). | F2'de hover/odak standardı ile birlikte tara. | `ix-focus-1440.png` |
| D3 | Footer · 390 | Footer yasal bağlantılar 3 satıra serilir, dil değiştirici sola kaymış (EN, 12 px içerden). | Yasal bağlantı grid'i, dil seçici hizası. | `tr--390.png` |
| D4 | Ana sayfa · 1440 | Hero altında ~70 px ölü boşluk, hero sağ paneli yalnız metin listesi (görsel ağırlığı zayıf); koyu "Çözümler" bölümünde kartlar çok koyu (yüzey/zemin kontrastı düşük). | Hero panelini ürün ekran görüntüsü / illüstrasyonla zenginleştir; kart yüzeyini aç. | `tr--1440.png` |
| D5 | `/tr/yasal/*` · 1440 | Uzun yasal metinler (4600 px) içindekiler/çapa yok. | Yan "Bu sayfada" ya da başlık çapaları. | `tr__yasal__eula--1440.png` |
| D6 | Ürün detay SSS · 1440 | SSS tek sütun dar, 3 soru ile bölüm çok seyrek; sekme çubuğu hero'dan ayrışmıyor (koyu üstüne koyu). | Sekme çubuğuna açık ayraç. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |

## Doğrulanan iyi durumlar

- Layout kayması yok (CLS 0.000 Lighthouse, 432 sayfada Playwright CLS ≤ 0.02).
- JS kapalıyken tüm içerik görünür; reveal sonrası takılı gizli öğe yok.
- Mega menü, mobil menü, odak halkası çalışıyor; hiçbir sayfada belge düzeyinde yatay kaydırma yok.
- Konsol hatası ve kırık görsel yok.

## Kullanıcının bildirdiği hatalar

