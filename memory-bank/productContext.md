# Product Context

## Why it exists
The company's software portfolio (5-20 products) must be in one place, searchable, and available for quote requests. Like the layout of large product companies (Vizrt, Blackmagic): product families, solutions, a support center, and downloads.

## Problems it solves
- Product information is scattered; downloads and documentation cannot be found by product/edition/OS → catalog + support center.
- A quote or demo must be requestable for every product/edition → promotion and request collection.
- Customers must see their licenses and downloads in one place → customer portal `/hesap`.
- The content team and AI agents must be able to manage content without technical knowledge → Payload panel + API/MCP + JSON import.

## User flows (target)
1. **Visitor searches for a product:** header mega menu (family → product) or `/ara` → product page.
2. **Product page:** tabs Overview · Features · Technical Specs & System Requirements · Editions · Downloads · Documentation.
3. **Quote:** select an edition → `/teklif-iste?urun=...&surum=SKU` → lead e-mail + admin record.
4. **License assignment:** an authorized administrator selects the customer and edition via the panel/API/MCP; the key is generated, the subscription period is calculated. The customer sees the license in the portal.
5. **Demo:** `/demo-talep` form.
6. **Support:** `/destek` → download (filtered by product/edition/OS), documentation, release notes, FAQ, support request.
7. **Customer:** `/hesap` → licenses, licensed downloads, support requests, profile.

## UX goals
- Next generation, minimal, professional; comprehensive but not flashy.
- Large typography, generous whitespace; product screenshots/videos stand out.
- Information pages (documentation, support, portal, technical specs) are open and readable.
- No horizontal scrolling at phone width; accessibility at WCAG AA.
- Language switching: the corresponding language path of the same content (hreflang, `LanguageSwitcher`).
- Form spam protection: Cloudflare Turnstile server verification + honeypot + IP limit (Phase 4).

## Design spirit
- Cinematic dark showcases (hero, product introductions) + light information areas.
- Reference: Vizrt / Blackmagic. Not copied; only structure and tone.
- Restrained motion (Motion, scroll reveal).
- Font: Geist Sans + Geist Mono (`next/font`).

## Palette (user-approved, cobalt as the single accent)
Pure black/white are not used. All colors are CSS variables (tokens) in `globals.css`.

| Token | Dark | Light |
|---|---|---|
| `bg` | `#0B0D10` | `#F7F8FA` |
| `surface` | `#13161B` | `#FFFFFF` |
| `surface-2` | `#1B1F26` | `#F0F2F5` |
| `border` | `#262B33` | `#E3E6EA` |
| `text` | `#E7E9EC` | `#12161C` |
| `text-muted` | `#9AA2AD` | `#5A6370` |
| `accent` (cobalt) | `#4C7DFF` | `#2F5FE0` |
| `accent-hover` | `#6B93FF` | `#244CC0` |
| `success` / `warning` / `danger` | `#2FB37A` / `#E0A63B` / `#E5574F` | dark variants of the same tones |

- Section theme: `<Section theme="dark|light">`.
- If the brand changes, only the token file changes.
- Contrast is verified with WCAG AA.

## Component set (target)
Header (mega menu), Footer, Hero (video/image), ProductCard, FeatureGrid, SpecTable, Edition cards (Request a Quote), CaseStudyCard, LogoWall, CTA band, Breadcrumb, Tabs, Accordion (FAQ), DownloadList, ReleaseNotes, Form renderer.
