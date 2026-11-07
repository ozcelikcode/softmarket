import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SupportFrame } from '@/components/sections/support-frame'
import { initLocale } from '@/lib/page-utils'
import { buildMetadata } from '@/lib/seo'
import type { Query } from '@/lib/support-query'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Query> }
import { LeadFormSection } from '@/components/forms/lead-form-section'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return buildMetadata({ locale, path: '/teklif-iste', title: t('quote') })
}

async function FormPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const t = await getTranslations({ locale, namespace: 'supportCenter' })
  return (
    <SupportFrame locale={locale} title={t('quote')} path="/teklif-iste" lead={t('formLead')}>
      <div className="max-w-3xl">
        <LeadFormSection kind="quote" locale={locale} query={await searchParams} />
      </div>
    </SupportFrame>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><FormPage {...props} /></DynamicSecurity>
}
