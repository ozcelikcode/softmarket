import { ImageResponse } from 'next/og'

import { deriveAccent } from '@/lib/brand'
import { getSiteSettings, siteIdentity } from '@/lib/site'

export const alt = 'SoftMarket — Enterprise software / Kurumsal yazılım'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const revalidate = 3600

export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const en = locale === 'en'
  // CMS site name/tagline/accent (F7); i18n-free fallbacks keep the image working when the DB is unavailable.
  const site = siteIdentity(await getSiteSettings(en ? 'en' : 'tr'), 'SoftMarket')
  const brand = deriveAccent(site.accent)
  const accent = brand.ok ? brand.dark.accent : '#4C7DFF'
  return new ImageResponse(
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '72px', background: '#0B0D10', color: '#E7E9EC', fontFamily: 'sans-serif', borderLeft: `16px solid ${accent}` }}>
      <div style={{ display: 'flex', fontSize: 42, color: accent }}>{site.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700 }}>{site.tagline ?? (en ? 'Software for your business.' : 'İşiniz için kurumsal yazılım.')}</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#9AA2AD' }}>{en ? 'Products · Solutions · Support' : 'Ürünler · Çözümler · Destek'}</div>
      </div>
    </div>, size,
  )
}
