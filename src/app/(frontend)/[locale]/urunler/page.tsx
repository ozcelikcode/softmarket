import { DynamicSecurity } from '@/components/security/dynamic-security'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { JsonLd } from '@/components/sections/json-ld'
import { EmptyState } from '@/components/sections/empty-state'
import { SystemBody, SystemHero, systemMeta } from '@/components/pages/system-page'
import { ProductCard } from '@/components/sections/product-card'
import { AppLink } from '@/components/ui/app-link'
import { Container } from '@/components/ui/container'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { anim } from '@/lib/anim'
import { getCatalogProducts, getFamilies, getSystemPage, mediaOf, relOf } from '@/lib/content'
import { first, initLocale } from '@/lib/page-utils'
import { breadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils'
import type { ProductFamily } from '@/payload-types'

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'products' }), getSystemPage(locale, 'products')])
  return buildMetadata({ locale, path: '/urunler', ...systemMeta(page, { title: t('title'), lead: t('lead') }), image: mediaOf(page?.meta?.image)?.url })
}

async function ProductsPage({ params, searchParams }: Props) {
  const locale = await initLocale(params)
  const sp = await searchParams
  const [t, c, families, products, page] = await Promise.all([
    getTranslations({ locale, namespace: 'products' }),
    getTranslations({ locale, namespace: 'common' }),
    getFamilies(locale),
    getCatalogProducts(locale),
    getSystemPage(locale, 'products'),
  ])
  const active = families.find((f) => f.slug === first(sp.aile))
  const visible = active
    ? products.filter((p) => (relOf<ProductFamily>(p.family)?.id ?? p.family) === active.id)
    : products
  const fallback = { title: t('title'), lead: t('lead') }
  const trail = [{ label: c('home'), href: '/' }, { label: fallback.title, href: '/urunler' }]

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(locale, trail)} />
      <SystemHero locale={locale} crumbLabel={c('breadcrumb')} crumbs={trail} page={page} fallback={fallback} />
      <SystemBody locale={locale} page={page} listing={
        <Container>
          {families.length > 1 ? (
            <nav aria-label={t('filter')} className="mb-10 flex flex-wrap gap-2">
              {[{ id: 0, title: t('all'), slug: null as string | null }, ...families.map((f) => ({ id: f.id, title: f.title, slug: f.slug! }))].map((f) => {
                const on = (active?.slug ?? null) === f.slug
                return (
                  <AppLink
                    key={f.id}
                    href={f.slug ? `/urunler?aile=${encodeURIComponent(f.slug)}` : '/urunler'}
                    locale={locale}
                    aria-current={on ? 'true' : undefined}
                    className={cn(
                      'inline-flex h-9 items-center rounded-full border px-4 text-small font-medium transition-colors',
                      on ? 'border-accent bg-accent text-accent-contrast' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text',
                    )}
                  >
                    {f.title}
                  </AppLink>
                )
              })}
            </nav>
          ) : null}
          {visible.length ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((p, i) => {
                const fam = relOf<ProductFamily>(p.family)!
                return (
                  <div key={p.id} {...anim(i % 3)} className="h-full">
                    <ProductCard
                      headingAs="h2"
                      title={p.title}
                      description={p.tagline ?? p.summary ?? undefined}
                      href={`/urunler/${encodeURIComponent(fam.slug!)}/${encodeURIComponent(p.slug!)}`}
                      locale={locale}
                      badge={fam.title}
                      icon={<NamedIcon name={fam.icon} />}
                      image={mediaOf(p.heroImage) ? <MediaImage media={p.heroImage} /> : undefined}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title={t('emptyTitle')} description={t('emptyDesc')} />
          )}
        </Container>
      } />
    </>
  )
}

export default function Page(props: Props) {
  return <DynamicSecurity><ProductsPage {...props} /></DynamicSecurity>
}
