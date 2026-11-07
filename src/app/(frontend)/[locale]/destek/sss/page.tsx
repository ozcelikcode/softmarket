import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { SupportFrame } from '@/components/sections/support-frame'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { SupportFilters } from '@/components/sections/support-filters'
import { JsonLd } from '@/components/sections/json-ld'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { RichContent } from '@/components/blocks/rich-text'
import { richTextPlain } from '@/lib/doc-content'
import { getFaqs, getSupportProducts } from '@/lib/support'
import { boundedQuery } from '@/lib/support-query'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/destek/sss', title: t('faq') })
}

async function FaqPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  const products = await getSupportProducts(locale)
  const q = await searchParams
  const product = boundedQuery(q.urun),
    category = boundedQuery(q.kategori, 20)
  const selected = products.find((p) => p.slug === product)
  if (
    product === null ||
    category === null ||
    (product && !selected) ||
    (category && !['general', 'licensing', 'billing', 'technical'].includes(category))
  )
    notFound()
  const faqs = await getFaqs(locale, selected?.id, category)
  return (
    <SupportFrame locale={locale} title={t('faq')} path="/destek/sss">
      {faqs.length ? (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: richTextPlain(f.answer) },
            })),
          }}
        />
      ) : null}
      <SupportFilters
        locale={locale}
        path="/destek/sss"
        products={products}
        product={product}
        category={category}
      />
      {(['general', 'licensing', 'billing', 'technical'] as const).map((category) => {
        const group = faqs.filter((f) => (f.category ?? 'general') === category)
        return group.length ? (
          <section key={category} className="mb-8">
            <h2 className="mb-3 text-h3">{t(category)}</h2>
            <Accordion type="multiple">
              {group.map((f) => (
                <AccordionItem key={f.id} value={String(f.id)}>
                  <AccordionTrigger>{f.question}</AccordionTrigger>
                  <AccordionContent>
                    <RichContent data={f.answer} locale={locale} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ) : null
      })}
      {!faqs.length ? <p>{t('empty')}</p> : null}
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><FaqPage {...props} /></DynamicSecurity>
}
