# Ürün Bağlamı

## Neden var
Şirketin yazılım portföyü (5-20 ürün) tek yerde, aranabilir ve teklif talep edilebilir olmalı. Büyük ürün şirketlerinin (Vizrt, Blackmagic) düzeninde: ürün aileleri, çözümler, destek merkezi ve indirmeler.

## Çözdüğü sorunlar
- Ürün bilgisi dağınık; ürün/sürüm/OS'e göre indirme ve doküman bulunamıyor → katalog + destek merkezi.
- Her ürün/sürüm için teklif veya demo talep edilebilmeli → tanıtım ve talep toplama.
- Müşteri lisanslarını ve indirmelerini tek yerde görmeli → müşteri portalı `/hesap`.
- İçerik ekibi ve yapay zekâ ajanları, teknik bilgi olmadan içerik yönetebilmeli → Payload panel + API/MCP + JSON import.

## Kullanıcı akışları (hedef)
1. **Ziyaretçi, ürün arar:** Header mega menü (aile → ürün) veya `/ara` → ürün sayfası.
2. **Ürün sayfası:** sekmeler Genel Bakış · Özellikler · Teknik Özellikler & Sistem Gereksinimleri · Sürümler · İndirmeler · Dokümantasyon.
3. **Teklif:** edition seç → `/teklif-iste?urun=...&surum=SKU` → lead e-postası + admin kaydı.
4. **Lisans atama:** yetkili yönetici panel/API/MCP üzerinden müşteri ve sürümü seçer; anahtar üretilir, abonelik süresi hesaplanır. Müşteri portalda lisansını görür.
5. **Demo:** `/demo-talep` formu.
6. **Destek:** `/destek` → indirme (ürün/sürüm/OS filtreli), doküman, sürüm notu, SSS, destek talebi.
7. **Müşteri:** `/hesap` → lisanslar, lisanslı indirmeler, destek talepleri, profil.

## UX hedefleri
- Yeni nesil, minimal, profesyonel; kapsamlı ama abartısız.
- Büyük tipografi, bol boşluk, ürün ekran görüntüsü/videosu öne çıkar.
- Bilgi sayfaları (doküman, destek, portal, teknik özellik) açık ve okunaklı.
- Telefon genişliğinde yatay kaydırma yok; erişilebilirlik WCAG AA.
- Dil değiştirme: aynı içeriğin karşılık gelen dil yolu (hreflang, `LanguageSwitcher`).
- Form spam koruması: Cloudflare Turnstile sunucu doğrulaması + honeypot + IP limiti (Faz 4).

## Tasarım ruhu
- Sinematik koyu vitrinler (hero, ürün tanıtım) + açık bilgi alanları.
- Referans: Vizrt / Blackmagic. Kopyalanmaz; yalnızca yapı ve ton.
- Hareket ölçülü (Motion, scroll reveal).
- Font: Geist Sans + Geist Mono (`next/font`).

## Palet (kullanıcı onaylı, kobalt tek vurgu)
Saf siyah/beyaz kullanılmaz. Tüm renkler `globals.css` içinde CSS değişkeni (token).

| Token | Koyu | Açık |
|---|---|---|
| `bg` | `#0B0D10` | `#F7F8FA` |
| `surface` | `#13161B` | `#FFFFFF` |
| `surface-2` | `#1B1F26` | `#F0F2F5` |
| `border` | `#262B33` | `#E3E6EA` |
| `text` | `#E7E9EC` | `#12161C` |
| `text-muted` | `#9AA2AD` | `#5A6370` |
| `accent` (kobalt) | `#4C7DFF` | `#2F5FE0` |
| `accent-hover` | `#6B93FF` | `#244CC0` |
| `success` / `warning` / `danger` | `#2FB37A` / `#E0A63B` / `#E5574F` | aynı tonların koyu varyantı |

- Bölüm teması: `<Section theme="dark|light">`.
- Marka değişirse yalnızca token dosyası değişir.
- Kontrast WCAG AA ile doğrulanır.

## Bileşen seti (hedef)
Header (mega menü), Footer, Hero (video/görsel), ProductCard, FeatureGrid, SpecTable, Sürüm kartları (Teklif İste), CaseStudyCard, LogoWall, CTA band, Breadcrumb, Tabs, Accordion (SSS), DownloadList, ReleaseNotes, Form renderer.
