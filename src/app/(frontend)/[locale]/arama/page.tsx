import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

import { redirect } from 'next/navigation'
import { localizedHref } from '@/i18n/paths'
import { initLocale } from '@/lib/page-utils'
export default async function LegacySearch({ params }: { params: Promise<{ locale: string }> }) {
  redirect(localizedHref('/ara', await initLocale(params)))
}
