import { routing } from '@/i18n/routing'
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })) }

export const dynamic = 'error'

import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { JsonLd } from '@/components/sections/json-ld'
import { CtaBand } from '@/components/sections/cta-band'
import { EmptyState } from '@/components/sections/empty-state'
import { LogoWall, type Logo } from '@/components/sections/logo-wall'
import { MediaCard } from '@/components/sections/media-card'
import { ProductCard } from '@/components/sections/product-card'
import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Eyebrow, Heading, SectionHeading } from '@/components/ui/heading'
import { NamedIcon } from '@/components/ui/icon'
import { MediaImage } from '@/components/ui/media-image'
import { Reveal } from '@/components/ui/reveal'
import { Section } from '@/components/ui/section'
import {
  getCaseStudies, getCatalogProducts, getContactSettings, getFamilies, getPartners, getPosts, getSolutions, mediaOf,
} from '@/lib/content'
import { formatDate } from '@/lib/format'
import { initLocale } from '@/lib/page-utils'
import { absoluteUrl, buildMetadata, siteUrl } from '@/lib/seo'
import { safeHref } from '@/lib/utils'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await initLocale(params)
  const [t, settings] = await Promise.all([getTranslations({ locale, namespace: 'common' }), getContactSettings(locale)])
  const name = settings?.siteName || t('siteName')
  const tagline = settings?.tagline || t('tagline')
  return buildMetadata({
    locale, path: '/', title: `${name} | ${tagline}`, description: tagline,
    image: mediaOf(settings?.defaultOgImage)?.url,
  })
}

export default async function HomePage({ params }: Props) {
  const locale = await initLocale(params)
  const [t, c, n, pr, families, products, solutions, cases, partners, posts, settings] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'news' }),
    getTranslations({ locale, namespace: 'products' }),
    getFamilies(locale, 6),
    getCatalogProducts(locale, { limit: 200 }),
    getSolutions(locale, 4),
    getCaseStudies(locale, { limit: 12 }),
    getPartners(locale, 12),
    getPosts(locale, { limit: 3 }),
    getContactSettings(locale),
  ])

  const countByFamily = new Map<number, number>()
  for (const p of products) {
    const id = typeof p.family === 'object' ? p.family.id : p.family
    countByFamily.set(id, (countByFamily.get(id) ?? 0) + 1)
  }

  const logos: Logo[] = [
    ...partners.filter((p) => mediaOf(p.logo)).map((p) => ({ name: p.name, src: mediaOf(p.logo)!.url! })),
    ...cases.filter((cs) => mediaOf(cs.customerLogo)).map((cs) => ({ name: cs.customerName, src: mediaOf(cs.customerLogo)!.url! })),
  ].filter((l, i, a) => a.findIndex((x) => x.name === l.name) === i).slice(0, 12)

  const featured = cases.find((cs) => cs.featured) ?? cases[0]
  const siteName = settings?.siteName || c('siteName')
  const social = (settings?.social ?? []).map((s) => safeHref(s.url)).filter((u): u is string => Boolean(u))
  const logo = mediaOf(settings?.logo)?.url
  const contact = settings?.contact

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: absoluteUrl('/', locale),
    ...(logo ? { logo: logo.startsWith('http') ? logo : `${siteUrl()}${logo}` } : {}),
    ...(social.length ? { sameAs: social } : {}),
    ...(contact?.email || contact?.phone
      ? { contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer support', ...(contact.email ? { email: contact.email } : {}), ...(contact.phone ? { telephone: contact.phone } : {}) }] }
      : {}),
  }

  return (
    <>
      <JsonLd data={organization} />

      {/* Cinematic hero */}
      <Section theme="dark" spacing="none" className="overflow-hidden pb-20 pt-40 sm:pb-28 sm:pt-48">
        <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
        <Container size="wide" className="relative grid items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <Eyebrow className="mb-6">{t('eyebrow')}</Eyebrow>
            <Heading size="display">{t('title')}</Heading>
            <p className="mt-6 max-w-xl text-lead text-muted text-pretty">{t('lead')}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <AppLink href="/demo-talep" locale={locale}>{t('ctaPrimary')}</AppLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <AppLink href="/urunler" locale={locale}>{t('ctaSecondary')}<ArrowRight aria-hidden /></AppLink>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.1} y={24}>
            <div className="rounded-xl border border-border bg-surface p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
              <div className="rounded-lg border border-border bg-bg p-5">
                <div className="flex items-center justify-between">
                  <div aria-hidden className="flex gap-1.5">
                    <span className="size-2.5 rounded-full bg-border-strong" /><span className="size-2.5 rounded-full bg-border-strong" /><span className="size-2.5 rounded-full bg-border-strong" />
                  </div>
                  <span className="font-mono text-xs text-muted">{t('panelTitle')}</span>
                </div>
                <ul className="mt-5 space-y-2">
                  {families.length ? families.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      <AppLink href={`/urunler/${encodeURIComponent(f.slug!)}`} locale={locale} className="group flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-2">
                        <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-bg text-accent"><NamedIcon name={f.icon} className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-small font-medium text-text">{f.title}</span>
                          {f.tagline ? <span className="block truncate text-xs text-muted">{f.tagline}</span> : null}
                        </span>
                        <span className="font-mono text-xs text-muted">{countByFamily.get(f.id) ?? 0}</span>
                        <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                      </AppLink>
                    </li>
                  )) : [88, 64, 76, 52].map((w, i) => (
                    <li key={i} aria-hidden className="flex items-center gap-4 rounded-md border border-border bg-surface px-4 py-3">
                      <span className="size-9 rounded-md border border-border bg-bg" />
                      <span className="flex-1 space-y-2"><span className="block h-1.5 rounded-full bg-surface-2" style={{ width: `${w}%` }} /><span className="block h-1.5 w-1/3 rounded-full bg-surface-2" /></span>
                    </li>
                  ))}
                </ul>
                {!families.length ? <p className="mt-4 text-center text-xs text-muted">{t('panelEmpty')}</p> : null}
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Product families */}
      <Section theme="light" spacing="lg">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading eyebrow={t('familiesEyebrow')} title={t('familiesTitle')} lead={t('familiesLead')} />
            <Button asChild variant="secondary"><AppLink href="/urunler" locale={locale}>{c('viewAll')}<ArrowRight aria-hidden /></AppLink></Button>
          </div>
          <div className="mt-14">
            {families.length ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {families.map((f, i) => (
                  <Reveal key={f.id} delay={(i % 3) * 0.06} className="h-full">
                    <ProductCard
                      title={f.title} description={f.tagline ?? undefined} href={`/urunler/${encodeURIComponent(f.slug!)}`} locale={locale}
                      icon={<NamedIcon name={f.icon} />}
                      badge={countByFamily.get(f.id) ? pr('count', { count: countByFamily.get(f.id)! }) : undefined}
                      image={mediaOf(f.image) ? <MediaImage media={f.image} className="transition-transform duration-500 group-hover:scale-[1.03]" /> : undefined}
                    />
                  </Reveal>
                ))}
              </div>
            ) : (
              <EmptyState title={t('familiesEmptyTitle')} description={t('familiesEmptyDesc')} />
            )}
          </div>
        </Container>
      </Section>

      {/* Solutions */}
      {solutions.length ? (
        <Section theme="dark" spacing="lg" className="border-t border-border">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow={t('solutionsEyebrow')} title={t('solutionsTitle')} lead={t('solutionsLead')} />
              <Button asChild variant="secondary"><AppLink href="/cozumler" locale={locale}>{c('viewAll')}<ArrowRight aria-hidden /></AppLink></Button>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {solutions.map((s, i) => (
                <Reveal key={s.id} delay={i * 0.05} className="h-full">
                  <ProductCard title={s.title} description={s.summary ?? undefined} href={`/cozumler/${encodeURIComponent(s.slug!)}`} locale={locale} icon={<NamedIcon name="workflow" />} />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* Reference logos */}
      {logos.length ? (
        <Section theme="light" spacing="md" className="border-t border-border">
          <Container>
            <p className="mb-8 text-center text-small text-muted">{t('logosTitle')}</p>
            <LogoWall logos={logos} />
          </Container>
        </Section>
      ) : null}

      {/* Featured case study */}
      {featured ? (
        <Section theme="dark" spacing="lg" className="border-t border-border">
          <Container className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow className="mb-4">{t('caseEyebrow')}</Eyebrow>
              <Heading as="h2" size="h1">{featured.title}</Heading>
              <p className="mt-3 text-small text-muted">{featured.customerName}</p>
              {featured.summary ? <p className="mt-5 text-lead text-muted text-pretty">{featured.summary}</p> : null}
              <Button asChild className="mt-8" variant="secondary">
                <AppLink href={`/referanslar/${encodeURIComponent(featured.slug!)}`} locale={locale}>{c('learnMore')}<ArrowRight aria-hidden /></AppLink>
              </Button>
            </div>
            {featured.results?.length ? (
              <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
                {featured.results.slice(0, 4).map((r, i) => (
                  <div key={r.id ?? i} className="bg-surface p-6">
                    <dd className="font-mono text-h1 text-text">{r.value}</dd>
                    <dt className="mt-2 text-small text-muted">{r.label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </Container>
        </Section>
      ) : null}

      {/* News */}
      {posts.docs.length ? (
        <Section theme="light" spacing="lg" className="border-t border-border">
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading eyebrow={t('newsEyebrow')} title={t('newsTitle')} />
              <Button asChild variant="secondary"><AppLink href="/haberler" locale={locale}>{c('viewAll')}<ArrowRight aria-hidden /></AppLink></Button>
            </div>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {posts.docs.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.06} className="h-full">
                  <MediaCard
                    href={`/haberler/${encodeURIComponent(p.slug!)}`} locale={locale} title={p.title} description={p.excerpt}
                    image={p.coverImage} badge={p.category ? n(`cat.${p.category}`) : null} meta={formatDate(p.publishedAt, locale)}
                  />
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <CtaBand
        title={t('ctaTitle')}
        lead={t('ctaLead')}
        actions={
          <>
            <Button asChild size="lg"><AppLink href="/demo-talep" locale={locale}>{c('requestDemo')}</AppLink></Button>
            <Button asChild size="lg" variant="secondary"><AppLink href="/teklif-iste" locale={locale}>{c('requestQuote')}</AppLink></Button>
          </>
        }
      />
    </>
  )
}
