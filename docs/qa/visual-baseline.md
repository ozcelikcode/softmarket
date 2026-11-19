# Visual QA baseline (F0, 2026-11-07)

Scope: 144 public URLs in `sitemap.xml` (TR+EN) × 390/768/1440 = 432 full-page screenshots (prod build, 127.0.0.1:3200, scrolled to bottom to trigger reveal).
Screenshots: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/visual/` (filename: `<path, __ instead of />--<width>.png`, e.g., `tr__urunler__akis-yonetimi__akis-merkezi--1440.png`). Interaction screenshots are in the parent of the same directory: `ix-*.png` (`.../scratchpad/ix-mobile-menu-390.png`, `ix-mega-1440.png`, `ix-focus-1440.png`, `ix-teklif-top-1440.png`).
Reproduction: `node scripts/qa-screenshots.mjs <urls.txt> <outDir> [baseUrl]` (the same run produces `probe.json`).

Automated check (all 432 images): all HTTP 200; 0 console errors; 0 broken images; 0 document overflow per page; 0 pages with CLS > 0.02; 0 stuck hidden reveal elements; 0 `opacity:0` elements with JS disabled. Horizontal clipping (without document overflow, hidden by `overflow-x`) exists only in K1 and Y6 below.
Note: Only TR pages were visually inspected (TR and EN use the same components); for 1440 all page types, for 390 home page, product detail, contact, support, FAQ, and for 768 automated checks were reviewed. 768 screenshots were not inspected individually.

## Critical

| # | Page / width | Issue | Recommendation | Image |
|---|---|---|---|---|
| ~~K1~~ ✅ | `/tr`, `/en` · 390 | Hero lead paragraph and right-hand `Ürün aileleri` ("Product families") panel are clipped on the right (`"güvenle"`, `"kurulumu hızlı, yö..."` cut off; panel cards overflow off-screen). Not visible in document overflow measurement because clipping is hidden. Cause: grid child `min-width:auto` (DIV without class exceeds 390 px). | `min-w-0` on grid child, `w-full max-w-full` on panel; `break-words` on lead. | `tr--390.png`, `en--390.png` |
| ~~K2~~ ✅ | `/tr/teklif-iste`, `/tr/demo-talep`, `/en/request-quote`, `/en/request-demo` · 1440 (header on mobile should be checked separately) | Header is transparent with light text (`rgb 231,233,236`) while hero has a light background: "SoftMarket" logo is barely visible and menu items have low contrast. Support pages are correct (dark text). Critical because these are primary conversion pages. | Derive header theme decision from page hero theme (dark text if hero is `light`) or give these pages a dark hero; single source like `data-header-theme`. | `tr__teklif-iste--1440.png`, `ix-teklif-top-1440.png` |

## High

| # | Page / width | Issue | Recommendation | Image |
|---|---|---|---|---|
| ~~Y1~~ ✅ (partial) | `/tr/iletisim`, `/en/contact` · all | Raw placeholders visible: `[ŞİRKET ADRESİ]`, `[COMPANY PHONE]`, `[ÇALIŞMA SAATLERİ]`. | Hide card until real data is entered or do not render if `SiteSettings` is empty. | `tr__iletisim--1440.png`, `tr__iletisim--390.png` |
| ~~Y2~~ ✅ | All pages · all | Brand inconsistent: header "SoftMarket", footer and home page `Örnek Kurumsal Yazılım` (`— demo içerik` copyright line). | Single source (`SiteSettings.siteName` + logo); remove `demo içerik` ("demo content") in production. | `tr--1440.png` (footer), `tr--390.png` |
| Y3 | `/tr/sirket/hakkimizda`, `/tr/referanslar`, `/tr/kariyer`, `/tr/is-ortaklari` · 1440 | Empty-state cards (`İçerik hazırlanıyor`, `Vaka çalışmaları yakında`, `Ortak listesi yakında`) are live in menu and footer; ~600 px empty space, no CTA. | Populate empty states with page builder blocks or remove from menu; add a CTA (contact) to the empty-state card. | `tr__sirket__hakkimizda--1440.png`, `tr__referanslar--1440.png`, `tr__kariyer--1440.png` |
| ~~Y4~~ ✅ | `/tr/haberler`, home page news section · all | No images on news cards; gray empty area (~140 px) takes half the card, badge disappears on gray background. | Remove cover area if no image, or use a branded placeholder (gradient + icon). | `tr__haberler--1440.png`, `tr--1440.png` |
| ~~Y5~~ ✅ | `/tr/urunler/*/*` (product detail) · 1440 | Section alignment inconsistent: overview paragraph and FAQ ~600 px narrow and centered; Features/Specs/Editions left-aligned in full container; system requirements card 1/2 width. Three different column grids on the same page. | Single container width + explicit `narrow` variant rule; requirements card full width. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |
| ~~Y6~~ ✅ | `/tr/urunler/*/*` · 390 | Sub-navigation tabs (`Genel Bakış...Dokümantasyon`) cut off as `Sü` on the right; not obvious it is scrollable (no fade/arrow). Breadcrumb wraps to 2 lines with `Akış Merkezi` alone on the second line. | Add right fade/shadow to tab bar, scroll active tab into view; `truncate` breadcrumb to single line or show parent level only. | `tr__urunler__akis-yonetimi__akis-merkezi--390.png` |
| ~~Y7~~ ✅ | `/tr/urunler/*/*` · 1440 | Product feature grid (4 items, 3 columns): 2 empty cells on the last row look like gray-filled "holes". | Do not fill empty cells (`gap`+card), or choose column count based on item count (2/4). | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |
| ~~Y8~~ ✅ | `/tr/urunler/*/*` · 1440 | Section rhythm: dark CTA band immediately followed by dark `Sürümler` ("Editions") section (two dark blocks side by side with a thin line). No button in CTA band (heading+text present, no action). | Put Editions on a light background or move CTA after Editions; add `Teklif İste` ("Request a Quote") button to CTA. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |

## Medium

| # | Page / width | Issue | Recommendation | Image |
|---|---|---|---|---|
| ~~O1~~ ✅ | All pages · 1440 | Three different container edges: header/footer and home hero start at ~72 px, page content/breadcrumb/heading at ~152 px; home hero and sections below it (152 px) are misaligned. | Single `--container` (e.g., 1200) across all sections, including hero. | `tr--1440.png`, `tr__urunler--1440.png` |
| ~~O2~~ ✅ | `/tr/destek`, `/tr/destek/*` · 1440 | Support and subpages have a light hero, all other pages have a dark hero: inconsistent theme transition. Also hero bottom edge has no line, gradient looks like a blurry smudge. | Single rule for hero theme (title page = dark). | `tr__destek--1440.png`, `tr__destek__sss--1440.png` |
| O3 | `/tr/destek` · 1440 | Search field (`Ara` button x=~511) and Product selector (`Uygula` x=~715) have different widths; the two form rows are misaligned. Search input has no placeholder. | Put both rows in the same grid; add placeholder. | `tr__destek--1440.png` |
| ~~O4~~ ✅ | `/tr/destek/surum-notlari` · 1440 | Typography hierarchy inverted: small `1.1.0 — Örnek bakım ve iyileştirme sürümü` line on top, larger `Bakım ve iyileştirme` heading below; same heading repeats across 8 cards, page ~6000 px. | Version number + date as large heading; summary text as body; pagination/collapsing. | `tr__destek__surum-notlari--1440.png` |
| O5 | `/tr/cozumler/*` · 1440 | Solution detail is barebones: only `İlgili ürünler` ("Related products", 2 cards left 2/3), ~600 px hero + empty bottom; no CTA. Solution cards on home page contain the same generic text in three places (`X için yazılım bileşenlerini birlikte değerlendiren örnek çözüm`). | Add problem/benefit blocks and CTA to solution page; differentiate card summaries. | `tr__cozumler__surec-otomasyonu--1440.png`, `tr--1440.png` |
| O6 | Product/solution/product list · 1440 | Orphan card on the last row (3+3+2 for 8 products; 2 edition cards left 2/3) leaves whitespace on the right. Cards' only action is a small arrow icon; weak clickability cue. | `auto-fit` grid + centering, `İncele` ("Explore") text link on card. | `tr__urunler--1440.png` |
| ~~O7~~ ✅ (partial) | `/tr/iletisim`, `/tr/teklif-iste` · 1440 | No required field indicator on forms, inputs close to background (low border contrast); submit button small and left-aligned. | Required `*`, border contrast ≥ 3:1, full-column button. | `tr__iletisim--1440.png`, `tr__teklif-iste--1440.png` |
| ~~O8~~ ✅ | Mobile menu · 390 | No logo in open menu (only close button), submenu items (`Ürünler`/`Çözümler`/`Şirket`) start collapsed, thin strip of page visible to the left of panel; large empty area in the middle. | Add logo to panel, full width, show sub-links with expand/collapse animation. | `ix-mobile-menu-390.png` |

## Low

| # | Page / width | Issue | Recommendation | Image |
|---|---|---|---|---|
| ~~D1~~ ✅ | Header mega menu · 1440 | Content is 3 columns from the left, ~25% empty on the right; `Tüm ürünler` ("All products") link is small. | Center/distribute columns; featured card on the right. | `ix-mega-1440.png` |
| ~~D2~~ ✅ | All pages · 1440 | Focus ring is visible (good) but was tested only on the menu button; card links and form fields should also be verified. Skip link (`#main`) target under 24 px (`sr-only`, expected). | Audit together with hover/focus standard in F2. | `ix-focus-1440.png` |
| D3 | Footer · 390 | Footer legal links wrap into 3 rows, language switcher shifted left (EN, 12 px inset). | Legal link grid, language switcher alignment. | `tr--390.png` |
| D4 | Home page · 1440 | ~70 px dead space below hero, hero right panel is only a text list (weak visual weight); cards in dark `Çözümler` ("Solutions") section are too dark (low surface/background contrast). | Enrich hero panel with product screenshot / illustration; lighten card surface. | `tr--1440.png` |
| D5 | `/tr/yasal/*` · 1440 | Long legal texts (4600 px) lack table of contents / anchors. | Side `Bu sayfada` ("On this page") or heading anchors. | `tr__yasal__eula--1440.png` |
| D6 | Product detail FAQ · 1440 | FAQ single column narrow, section very sparse with 3 questions; tab bar does not stand out from hero (dark on dark). | Clear separator on tab bar. | `tr__urunler__akis-yonetimi__akis-merkezi--1440.png` |

## Verified good states

- No layout shift (CLS 0.000 Lighthouse, Playwright CLS ≤ 0.02 across 432 pages).
- All content visible with JS disabled; no stuck hidden elements after reveal.
- Mega menu, mobile menu, focus ring work; no document-level horizontal scroll on any page.
- No console errors or broken images.

## User-reported bugs


## Fixed (G round, 2026-11-07)

- K1: hero grid `min-w-0`/`grid-cols-1`
- K2: all title pages dark hero; light header only in portal
- Y5: single Container, overview left-aligned, requirements card full width
- Y6: breadcrumb parent+current single line on mobile, tab bar surface + fade
- Y7: feature grid card + columns by item count
- Y8: Editions single dark section (extra blocks at end), fallback `Teklif İste` button on CTA band
- Y4: branded CSS placeholder
- O1: single `content` container for header/footer/hero/mega
- O2: support heroes dark (`PageHero` default)
- O4: version number large heading
- O8: logo in panel, full width on mobile
- D1: `Tüm ürünler` featured card in mega menu
- D2: `.card-hover` + global `focus-visible` standard

Remaining: Y1, Y2, Y3, Y5 (FAQ block narrow; FAQ component in Terra scope), O3, O5, O6, O7, D3–D6 none/deferred; Y1–Y3 content/brand (F6/F7). User-reported bugs section is empty.
After screenshots: `.../scratchpad/visual-after/` (10 pages × 390/768/1440), cropped: `.../scratchpad/crops/`.


## F11 round 2 (2026-11-07)

Scope: 144 URLs from sitemap × 390/768/1440 = 432 full-page screenshots, prod build (3200). Screenshots: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/f11/shots/` (+ `probe.json`). Visually inspected: 1440 × 12 page types, 390 × 4, 768 × 5 (TR). Automated check (432/432): all HTTP 200, 0 console errors, 0 broken images, 0 document overflow, CLS ≤ 0.02, 0 stuck hidden reveal. Horizontal clipping warning only on scrollable tab bar in product detail (expected, fade present).

### Closed / status

| # | Status | Note |
|---|---|---|
| K1, K2 | ✓ closed | No hero overflow at 390; quote/demo pages dark hero + readable header |
| Y1 | ✓ partial | Bracket placeholders (`[ŞİRKET ADRESİ]` …) removed; fake values (`+90 212 000 00 00`, `"İstanbul, Türkiye"`) remain in card: real contact info is a content task |
| Y2 | ✓ closed | Header, footer, copyright "SoftMarket"; no `demo içerik` text |
| Y3 | OPEN | `/tr/sirket/hakkimizda` (`İçerik hazırlanıyor`), `/tr/referanslar`, `/tr/kariyer` still empty-state card, ~600 px gap, no CTA (live in menu/footer). `/tr/is-ortaklari` now has `İş ortağımız olun` ("Become our partner") CTA. Reason: content (editor) task |
| Y4-Y8, O1, O2, O4, O8, D1, D2 | ✓ closed | G-round fixes verified at 1440/390/768. O4: version number large heading ✓; page still ~6400 px (no pagination) |
| O3 | OPEN | Support: `Ara` and `Uygula` rows still different widths; search input has no placeholder (only helper text below). Minor, left out of F11 scope |
| O5 | OPEN | Solution detail barebones (`İlgili ürünler` only, no CTA); card summaries generic. Content + block task (can be populated with F6 block system) |
| O6 | OPEN | `/tr/urunler` 3+3+2 orphan card; home page 3+... Only small arrow on card. Design decision |
| O7 | ✓ partial (F11) | `*` on required fields, input border `border-strong` (≥ 3:1); submit button still small/left-aligned |
| D3 | OPEN | Footer: language switcher on a separate row below legal links and shifted left; copyright text wraps to two lines in narrow column at 1440 (390, 768, 1440) |
| D4 | OPEN | Home hero panel weight weak (text list); resolved when image is supplied in CMS (image hero test page looks proper at 1440) |
| D5 | OPEN | No `Bu sayfada` on legal pages (4900–5500 px) |
| D6 | PARTIAL | Product tab bar separates from hero with dark band; FAQ/product detail FAQ width not separately checked |

### New findings (in priority order)

1. **High, content/legal:** `/tr/yasal/eula`, `/en/legal/*`, and other legal pages are published in sitemap, and the body shows `TASLAK — Yayın öncesi hukuk danışmanı tarafından incelenmelidir` ("DRAFT — Must be reviewed by legal counsel before publication") warning along with placeholders like `[ŞİRKET UNVANI]`, `[YÜRÜRLÜK TARİHİ]`, `[KVKK İLETİŞİM E-POSTASI]`. Before assigning a domain, they must either be moved to draft or populated.
2. **High, perf:** Text LCP 1.06 s but image hero LCP 3.0 s (mobile Lantern); JS 192 KB gzip (budget 130); font 2 × 70 KB. Details: `docs/perf/f11-acceptance.md`.
3. **Medium, conversion:** Product detail hero's only primary action is `Sürümler` ("Editions", in-page anchor); the actual conversion `Teklif İste` ("Request a Quote") is not in the hero (only in header and Editions cards).
4. **Medium, typography/rhythm:** On product detail, spacing between breadcrumb, eyebrow (`AKIŞ YÖNETİMİ`), and heading is too tight; top padding of product hero is noticeably tighter than title pages.
5. **Medium, content:** Release notes: same `Bakım ve iyileştirme` ("Maintenance and improvement") heading/text on 8 cards; no pagination or per-product grouping (6400 px).
6. **Medium, content:** Solution cards repeat the same generic sentence on home page and `/tr/cozumler` (`X için yazılım bileşenlerini birlikte değerlendiren örnek çözüm`); news cards share the same placeholder cover.
7. **Low, footer:** At 768, the bottom row (copyright + 5 links + language switcher) wraps unevenly and misaligned.
8. **Low, admin:** In Pages list `Sütunlar` ("Columns") selector, SEO plugin labels are in English (SEO > Overview/Title/Description/Meta Image/Preview); add block button was `Layout ekle` (changed to `Blok ekle` in F11).

### Minor fixes made in F11

- Lead form: required field indicator (`*`, `aria-hidden`; `required` already present) and `border-strong` input border (`src/components/forms/lead-form.tsx`).
- Admin: `layout` block field label `Blok/Bloklar` (`src/lib/admin-i18n.ts`) → `Blok ekle` ("Add block").
- After screenshot: `.../scratchpad/f11/after/` (3100 dev, `/tr/teklif-iste`, `/en/contact`).

## F11 round 3 / G2 fixes (2026-11-08)

Before/after screenshots: `/private/tmp/claude-501/-Users-ozcelik-dev-softmarket/86cb568c-5f6b-4b21-b0fe-e6a5de07c79f/scratchpad/g2/` (`before-*` dev 3100, `after-*` prod 3200; 390/1440).

| # | Status | Note |
|---|---|---|
| New 1 (legal draft) | CLOSED | `src/lib/legal-draft.ts`: if content contains `TASLAK —`/`DRAFT —` prefix or `[UPPERCASE]` placeholder, the page becomes `noindex, nofollow` and is excluded from sitemap (per locale). No schema field; opens for indexing automatically once editor cleans the content. Footer links remain. |
| New 3 | CLOSED | Product hero: primary `Teklif İste` (`/teklif-iste?urun=<slug>`), secondary `Sürümler` (anchor), brochure ghost. |
| New 4 | CLOSED | `PageHero` breadcrumb bottom margin `mb-10`, eyebrow `mb-5` (all title pages). |
| New 5 / O4 | CLOSED | Release notes grouped per product; latest release open (`Son sürüm` badge, heading `Ürün 1.2.0`), older ones collapsed with native `<details>`. Page dynamic (`force-dynamic`) rule preserved. |
| New 6 | CLOSED | `MediaCard` placeholder cover deterministic via slug (`href`) FNV hash: glow position/intensity, scan angle/frequency, glyph. CSS only. |
| D3 / New 7 | CLOSED | Footer bottom row single line at `lg` breakpoint; copyright `whitespace-nowrap`; language switcher with separator, aligned. |
| New 8 (admin SEO) | CLOSED | `localizeSeoFields` (`src/lib/admin-i18n.ts`) + seo plugin `fields`; test `tests/unit/admin-labels.test.ts`. |
| O7 | CLOSED | Submit button `lg`, full width on mobile, min `14rem` on desktop. |
