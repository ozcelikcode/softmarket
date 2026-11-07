/*
 * Built-in home page (pre-F6 composition), kept as the fallback when no CMS home page is published
 * (SiteSettings.homePage -> slug "home" -> this). Its CMS equivalent is the `home` record in
 * content/seed/05-pages.json; the two render the same markup.
 */
import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

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
import { Section } from '@/components/ui/section'
import {
  getCaseStudies, getProductFamilyCounts, getFamilies, getPartners, getPosts, getSolutions, mediaOf,
} from '@/lib/content'
import { anim, heroIn } from '@/lib/anim'
import { formatDate } from '@/lib/format'
import type { Locale } from '@/i18n/routing'

export async function FallbackHome({ locale }: { locale: Locale }) {
  const [t, c, n, pr, families, countByFamily, solutions, cases, partners, posts] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'common' }),
    getTranslations({ locale, namespace: 'news' }),
    getTranslations({ locale, namespace: 'products' }),
    getFamilies(locale, 6),
    getProductFamilyCounts(locale),
    getSolutions(locale, 4),
    getCaseStudies(locale, { limit: 12 }),
    getPartners(locale, 12),
    getPosts(locale, { limit: 3 }),
  ])

  const logos: Logo[] = [
    ...partners.filter((p) => mediaOf(p.logo)).map((p) => ({ name: p.name, src: mediaOf(p.logo)!.url! })),
    ...cases.filter((cs) => mediaOf(cs.customerLogo)).map((cs) => ({ name: cs.customerName, src: mediaOf(cs.customerLogo)!.url! })),
  ].filter((l, i, a) => a.findIndex((x) => x.name === l.name) === i).slice(0, 12)

  const featured = cases.find((cs) => cs.featured) ?? cases[0]

  return (
    <>
      {/* Cinematic hero */}
      <Section theme="dark" spacing="none" className="overflow-hidden pb-20 pt-40 sm:pb-28 sm:pt-48">
        <div aria-hidden className="bg-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 opacity-70" />
        <Container className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="min-w-0">
            <Eyebrow className="mb-6" {...heroIn(0)}>{t('eyebrow')}</Eyebrow>
            <Heading size="display" {...heroIn(1, 'slide')}>{t('title')}</Heading>
            <p className="mt-6 max-w-xl text-lead text-muted text-pretty break-words" {...heroIn(2, 'slide')}>{t('lead')}</p>
            <div className="mt-10 flex flex-wrap gap-3" {...heroIn(3)}>
              <Button asChild size="lg">
                <AppLink href="/demo-talep" locale={locale}>{t('ctaPrimary')}</AppLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <AppLink href="/urunler" locale={locale}>{t('ctaSecondary')}<ArrowRight aria-hidden /></AppLink>
              </Button>
            </div>
          </div>
          <div className="min-w-0" {...heroIn(4)}>
            <div className="w-full max-w-full rounded-xl border border-border bg-surface p-1.5 shadow-[0_30px_80px_-30px_color-mix(in_oklab,var(--accent)_35%,transparent)]">
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
          </div>
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
                  <div key={f.id} {...anim(i % 3)} className="h-full">
                    <ProductCard
                      title={f.title} description={f.tagline ?? undefined} href={`/urunler/${encodeURIComponent(f.slug!)}`} locale={locale}
                      icon={<NamedIcon name={f.icon} />}
                      badge={countByFamily.get(f.id) ? pr('count', { count: countByFamily.get(f.id)! }) : undefined}
                      image={mediaOf(f.image) ? <MediaImage media={f.image} className="transition-transform duration-500 group-hover:scale-[1.03]" /> : undefined}
                    />
                  </div>
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
                <div key={s.id} {...anim(i)} className="h-full">
                  <ProductCard title={s.title} description={s.summary ?? undefined} href={`/cozumler/${encodeURIComponent(s.slug!)}`} locale={locale} icon={<NamedIcon name="workflow" />} />
                </div>
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
                <div key={p.id} {...anim(i)} className="h-full">
                  <MediaCard
                    href={`/haberler/${encodeURIComponent(p.slug!)}`} locale={locale} title={p.title} description={p.excerpt}
                    image={p.coverImage} badge={p.category ? n(`cat.${p.category}`) : null} meta={formatDate(p.publishedAt, locale)}
                  />
                </div>
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
