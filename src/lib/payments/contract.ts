import type { Payload } from 'payload'

import { hasLegalBody, isLegalDraft } from '@/lib/legal-draft'

import { formatMoney } from './format'
import { bodySha256 } from './idempotency'
import { COMMERCE_LEGAL_KINDS, isCommerceLegalKind, type CommerceLegalKind } from './legal'
import type { AmountBreakdown } from './tax'
import type { Currency } from './types'

/*
 * Contract copy (plan §5, P5). The text the buyer sees on the checkout page and the text frozen into
 * `orders.contractSnapshot` come from the SAME published `pages.commerceLegal` pages (distance sales, pre-information,
 * refund/withdrawal) in the order language. Pure formatting + one server loader. The snapshot is built on the server at
 * submit time from the pages' current content (never from client-posted text); the checkout form carries a digest of
 * what was displayed and the action refuses the submit when the pages changed in between (`legalDigest`).
 */

export type LegalDoc = { kind: CommerceLegalKind; title: string; slug: string; text: string; updatedAt: string }
export type CommerceLegalSet = Record<CommerceLegalKind, LegalDoc>
type Locale = 'tr' | 'en'

// Lexical -> plain text -----------------------------------------------------------------------------------------

type LexNode = { type?: unknown; text?: unknown; children?: unknown; listType?: unknown }
const kids = (node: LexNode): LexNode[] => (Array.isArray(node.children) ? (node.children as LexNode[]) : [])

function inline(node: LexNode): string {
  if (node.type === 'text') return typeof node.text === 'string' ? node.text : ''
  if (node.type === 'linebreak') return '\n'
  if (node.type === 'tab') return '\t'
  return kids(node).map(inline).join('')
}

function blockText(node: LexNode): string {
  if (node.type === 'list') {
    const numbered = node.listType === 'number'
    return kids(node).map((item, i) => `${numbered ? `${i + 1}.` : '-'} ${inline(item)}`).join('\n')
  }
  if (node.type === 'heading' || node.type === 'paragraph' || node.type === 'quote' || node.type === 'text') return inline(node)
  const nested = kids(node)
  return nested.length ? nested.map(blockText).filter(Boolean).join('\n\n') : inline(node)
}

/** Visible rich text blocks of a page layout as plain text (blank line between blocks). */
export function layoutToPlainText(layout: unknown): string {
  if (!Array.isArray(layout)) return ''
  const parts: string[] = []
  for (const block of layout as { blockType?: unknown; appearance?: { hidden?: unknown }; content?: { root?: LexNode } }[]) {
    if (block?.blockType !== 'richText' || block.appearance?.hidden) continue
    const root = block.content?.root
    if (!root) continue
    const text = kids(root).map(blockText).filter((t) => t.trim()).join('\n\n')
    if (text.trim()) parts.push(text)
  }
  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

// Loader --------------------------------------------------------------------------------------------------------

/**
 * Published, non-draft sales pages in ONE locale (no locale fallback: an English order never freezes Turkish text).
 * Returns null unless all three kinds exist with a visible body and no draft banner/placeholder. Throws on read errors
 * (callers stay fail-closed).
 */
export async function loadCommerceLegalSet(payload: Payload, locale: Locale): Promise<CommerceLegalSet | null> {
  const { docs } = await payload.find({
    collection: 'pages', locale, fallbackLocale: false, depth: 0, limit: 20, pagination: false, overrideAccess: true, draft: false,
    where: { and: [{ pageType: { equals: 'legal' } }, { commerceLegal: { exists: true } }, { _status: { equals: 'published' } }] },
    select: { commerceLegal: true, layout: true, title: true, slug: true, updatedAt: true },
  })
  const set: Partial<CommerceLegalSet> = {}
  for (const doc of docs as { commerceLegal?: unknown; layout?: unknown; title?: string; slug?: string; updatedAt?: string }[]) {
    if (!isCommerceLegalKind(doc.commerceLegal)) continue
    if (!doc.title?.trim() || !doc.slug?.trim() || !doc.updatedAt || !hasLegalBody(doc.layout) || isLegalDraft(doc.layout)) return null
    const text = layoutToPlainText(doc.layout)
    if (!text) return null
    set[doc.commerceLegal] = { kind: doc.commerceLegal, title: doc.title.trim(), slug: doc.slug.trim(), text, updatedAt: doc.updatedAt }
  }
  return COMMERCE_LEGAL_KINDS.every((kind) => set[kind]) ? (set as CommerceLegalSet) : null
}

/** Digest of exactly what a buyer is shown; changes when any of the three pages is republished. */
export function legalDigest(set: CommerceLegalSet): string {
  return bodySha256(COMMERCE_LEGAL_KINDS.map((kind) => `${kind}\n${set[kind].updatedAt}\n${set[kind].text}`).join('\n--\n'))
}

// Snapshot ------------------------------------------------------------------------------------------------------

export type SnapshotSeller = { legalName?: string; taxOffice?: string; taxNumber?: string; mersisNo?: string; kepAddress?: string; address?: string; email?: string; phone?: string }
export type SnapshotBuyer = {
  type: 'individual' | 'corporate'
  name: string
  company?: string
  identityNumber?: string
  taxNumber?: string
  taxOffice?: string
  email: string
  phone: string
  addressLine: string
  district?: string
  city: string
  postalCode?: string
  country: string
}
export type SnapshotInput = {
  locale: Locale
  orderNumber: string
  acceptedAt: Date
  seller: SnapshotSeller
  buyer: SnapshotBuyer
  item: { title: string; sku: string; licenseType: 'perpetual' | 'subscription'; durationMonths?: number | null; seats?: number | null }
  amounts: AmountBreakdown
  taxMode: 'inclusive' | 'exclusive'
  legal: CommerceLegalSet
  waiverAccepted: boolean
}

const T = {
  tr: {
    title: 'SİPARİŞ SÖZLEŞME KOPYASI', order: 'Sipariş no', date: 'Onay zamanı (UTC)', seller: 'SATICI', buyer: 'ALICI', product: 'ÜRÜN',
    name: 'Ad soyad', company: 'Ticaret unvanı', identity: 'T.C. kimlik no', taxId: 'Vergi kimlik no', taxOffice: 'Vergi dairesi', email: 'E-posta', phone: 'Telefon',
    address: 'Adres', legalName: 'Unvan', mersis: 'MERSİS no', kep: 'KEP adresi', sku: 'SKU', licenseType: 'Lisans türü', perpetual: 'Kalıcı', subscription: 'Abonelik',
    duration: 'Süre (ay)', seats: 'Koltuk', amounts: 'TUTAR', net: 'Ara toplam (net)', vat: 'KDV', exempt: 'KDV istisnası', total: 'Genel toplam',
    tax: { inclusive: 'Fiyata KDV dahildir.', exclusive: 'Fiyata KDV eklenmiştir.' }, payment: 'Ödeme yöntemi: kredi/banka kartı (ödeme sayfası ödeme kuruluşuna aittir).',
    delivery: 'Teslimat: lisans ödeme onayından sonra elektronik ortamda anında teslim edilir.',
    waiver: 'Dijital içeriğin/hizmetin anında ifasına onay verildi ve cayma hakkının sona ereceği kabul edildi.',
    waiverNo: 'Anında ifa ve cayma istisnası onayı verilmedi (kurumsal alıcı).',
    accepted: 'Alıcı aşağıdaki metinleri okuyup onayladı.',
    kinds: { preInformation: 'ÖN BİLGİLENDİRME FORMU', distanceSales: 'MESAFELİ SATIŞ SÖZLEŞMESİ', refund: 'İADE VE CAYMA' },
    version: 'Sürüm',
  },
  en: {
    title: 'ORDER CONTRACT COPY', order: 'Order number', date: 'Accepted at (UTC)', seller: 'SELLER', buyer: 'BUYER', product: 'PRODUCT',
    name: 'Full name', company: 'Company name', identity: 'National ID (TCKN)', taxId: 'Tax ID (VKN)', taxOffice: 'Tax office', email: 'Email', phone: 'Phone',
    address: 'Address', legalName: 'Legal name', mersis: 'MERSIS no', kep: 'KEP address', sku: 'SKU', licenseType: 'License type', perpetual: 'Perpetual', subscription: 'Subscription',
    duration: 'Duration (months)', seats: 'Seats', amounts: 'AMOUNTS', net: 'Subtotal (net)', vat: 'VAT', exempt: 'VAT exempt', total: 'Grand total',
    tax: { inclusive: 'VAT is included in the price.', exclusive: 'VAT is added to the price.' }, payment: 'Payment method: credit/debit card (the payment page belongs to the payment institution).',
    delivery: 'Delivery: the license is delivered electronically and immediately after payment confirmation.',
    waiver: 'The buyer consented to immediate performance of the digital content/service and acknowledged that the right of withdrawal ends.',
    waiverNo: 'No immediate-performance / withdrawal waiver was given (corporate buyer).',
    accepted: 'The buyer read and accepted the following texts.',
    kinds: { preInformation: 'PRE-INFORMATION FORM', distanceSales: 'DISTANCE SALES AGREEMENT', refund: 'REFUND AND WITHDRAWAL' },
    version: 'Version',
  },
} as const

/** Keeps only the last 3 characters of an identity number in the snapshot. */
export const maskIdentity = (value: string | undefined): string => (value ? `${'•'.repeat(Math.max(0, value.length - 3))}${value.slice(-3)}` : '')

/** Frozen, human-readable contract copy: order facts first, then the three legal texts verbatim. */
export function buildContractSnapshot(input: SnapshotInput): string {
  const t = T[input.locale]
  const { seller, buyer, item, amounts, locale } = input
  const money = (minor: number, currency: Currency) => formatMoney(minor, currency, locale)
  const line = (label: string, value: string | number | null | undefined) => (value === undefined || value === null || String(value).trim() === '' ? null : `${label}: ${String(value).trim()}`)
  const sellerLines = [line(t.legalName, seller.legalName), line(t.taxOffice, seller.taxOffice), line(t.taxId, seller.taxNumber), line(t.mersis, seller.mersisNo), line(t.kep, seller.kepAddress), line(t.address, seller.address), line(t.email, seller.email), line(t.phone, seller.phone)]
  const address = [buyer.addressLine, buyer.district, buyer.postalCode, buyer.city, buyer.country].filter((v) => v && v.trim()).join(', ')
  const buyerLines = [
    line(t.name, buyer.name),
    buyer.type === 'corporate' ? line(t.company, buyer.company) : null,
    buyer.type === 'individual' ? line(t.identity, maskIdentity(buyer.identityNumber)) : line(t.taxId, maskIdentity(buyer.taxNumber)),
    buyer.type === 'corporate' ? line(t.taxOffice, buyer.taxOffice) : null,
    line(t.email, buyer.email), line(t.phone, buyer.phone), line(t.address, address),
  ]
  const productLines = [
    line(t.product, item.title), line(t.sku, item.sku),
    line(t.licenseType, item.licenseType === 'perpetual' ? t.perpetual : t.subscription),
    item.licenseType === 'subscription' ? line(t.duration, item.durationMonths) : null, line(t.seats, item.seats),
  ]
  const vatLine = amounts.exempt ? `${t.vat}: ${t.exempt}` : `${t.vat} (%${amounts.vatRateBasisPoints / 100}): ${money(amounts.vatMinor, amounts.currency)}`
  const header = [t.title, '='.repeat(t.title.length), line(t.order, input.orderNumber), line(t.date, input.acceptedAt.toISOString()), '']
  const sections = [
    [t.seller, ...sellerLines], [t.buyer, ...buyerLines], productLines,
    [t.amounts, `${t.net}: ${money(amounts.netMinor, amounts.currency)}`, vatLine, `${t.total}: ${money(amounts.totalMinor, amounts.currency)}`, t.tax[input.taxMode]],
    [t.payment, t.delivery, input.waiverAccepted ? t.waiver : t.waiverNo, t.accepted],
  ].map((lines) => lines.filter((l): l is string => Boolean(l)).join('\n'))
  const texts = (['preInformation', 'distanceSales', 'refund'] as const).map((kind) => {
    const doc = input.legal[kind]
    return `${t.kinds[kind]} — ${doc.title}\n${t.version}: ${doc.updatedAt}\n${'-'.repeat(24)}\n${doc.text}`
  })
  return [header.join('\n'), ...sections, ...texts].join('\n\n')
}

export const snapshotSha256 = (snapshot: string): string => bodySha256(snapshot)
