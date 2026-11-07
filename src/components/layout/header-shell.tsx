'use client'

import { ArrowRight, ChevronDown, Menu, Search, User } from 'lucide-react'
import { NavigationMenu } from 'radix-ui'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppLink } from '@/components/ui/app-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import type { MegaData, NavItem, NavLink, PublicImage } from '@/lib/site'
import { cn } from '@/lib/utils'

import { LanguageSwitcher } from './language-switcher'
import { Logo } from './logo'

type Labels = {
  siteName: string
  search: string
  account: string
  signIn: string
  signOut: string
  accountMenu: string
  menu: string
  close: string
  allProducts: string
  allSolutions: string
  catalogSoon: string
  utility?: string
}

type Utility = { links: NavLink[]; search: boolean; language: boolean; account: boolean }

type Props = {
  locale: string
  items: NavItem[]
  cta: NavLink
  secondaryCta?: NavLink | null
  mega: MegaData
  logo?: { dark: PublicImage | null; light: PublicImage | null }
  utility?: Utility
  labels: Labels
}

const DEFAULT_UTILITY: Utility = { links: [], search: true, language: true, account: true }

const triggerCls =
  'group inline-flex h-10 items-center gap-1 rounded-md px-3 text-small font-medium text-muted transition-colors hover:text-text data-[state=open]:text-text'

export function HeaderShell({ locale, items, cta, secondaryCta, mega, logo, utility = DEFAULT_UTILITY, labels }: Props) {
  const pathname = usePathname()
  // Only portal pages open on a light surface (no hero): the transparent header must switch to light tokens there.
  // Every other page starts with a dark hero (PageHero default), so one rule keeps header and hero consistent.
  const light = /^\/(?:tr|en)\/(?:hesap|account)(?:\/|$)/.test(pathname)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)')
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return (
    <header
      data-theme={light ? 'light' : 'dark'}
      className={cn(
        'sticky top-0 z-40 w-full border-b text-text transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled
          ? 'border-border bg-bg/70 backdrop-blur-xl supports-[not(backdrop-filter:blur(1px))]:bg-bg'
          : light ? 'border-transparent bg-bg' : 'border-transparent bg-transparent',
      )}
    >
      <Container className="flex h-16 items-center gap-6 lg:h-[4.5rem]">
        <Logo locale={locale} label={labels.siteName} image={light ? logo?.light : logo?.dark} />

        <NavigationMenu.Root aria-label={labels.menu} className="hidden flex-1 lg:block [&>div]:!static" style={{ position: 'static' }} delayDuration={80}>
          <NavigationMenu.List className="flex items-center gap-0.5">
            {items.map((item) => (
              <NavigationMenu.Item key={item.label}>
                {item.mega || item.children ? (
                  <>
                    <NavigationMenu.Trigger className={triggerCls}>
                      {item.label}
                      <ChevronDown
                        aria-hidden
                        className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                      />
                    </NavigationMenu.Trigger>
                    <NavigationMenu.Content className="absolute inset-x-0 top-full data-[state=open]:animate-[mega-in_180ms_ease-out]">
                      <div className="border-b border-border bg-bg/95 backdrop-blur-xl">
                        <Container className="py-8">
                          {item.mega === 'products' ? (
                            <ProductsMega
                              item={item}
                              data={mega}
                              locale={locale}
                              labels={labels}
                            />
                          ) : item.mega === 'custom' ? (
                            <CustomMega item={item} locale={locale} />
                          ) : item.mega === 'solutions' ? (
                            <SimpleMega
                              item={item}
                              links={mega.solutions}
                              locale={locale}
                              allLabel={labels.allSolutions}
                            />
                          ) : (
                            <SimpleMega item={item} links={item.children ?? []} locale={locale} />
                          )}
                        </Container>
                      </div>
                    </NavigationMenu.Content>
                  </>
                ) : item.href ? (
                  <NavigationMenu.Link asChild>
                    <AppLink href={item.href} locale={locale} target={item.newTab ? '_blank' : undefined} className={triggerCls}>
                      {item.label}
                    </AppLink>
                  </NavigationMenu.Link>
                ) : null}
              </NavigationMenu.Item>
            ))}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          {utility.search ? (
            <AppLink
              href="/ara"
              locale={locale}
              aria-label={labels.search}
              className="inline-flex size-11 items-center justify-center rounded-md text-muted lg:size-9 transition-colors hover:bg-surface-2 hover:text-text"
            >
              <Search aria-hidden className="size-[18px]" />
            </AppLink>
          ) : null}
          {utility.language ? <LanguageSwitcher className="hidden sm:inline-flex" /> : null}
          {utility.account ? <AccountMenu locale={locale} labels={labels} /> : null}
          {secondaryCta ? (
            <Button asChild size="sm" variant="secondary" className="ml-2 hidden xl:inline-flex">
              <AppLink href={secondaryCta.href} locale={locale} target={secondaryCta.newTab ? '_blank' : undefined}>
                {secondaryCta.label}
              </AppLink>
            </Button>
          ) : null}
          <Button asChild size="sm" className="ml-2 hidden sm:inline-flex">
            <AppLink href={cta.href} locale={locale} target={cta.newTab ? '_blank' : undefined}>
              {cta.label}
            </AppLink>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label={labels.menu}
                className="inline-flex size-11 items-center justify-center rounded-md text-text hover:bg-surface-2 lg:hidden"
              >
                <Menu aria-hidden className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent closeLabel={labels.close}>
              <SheetTitle className="sr-only">{labels.menu}</SheetTitle>
              <SheetDescription className="sr-only">{labels.siteName}</SheetDescription>
              <MobileNav
                items={items}
                cta={cta}
                secondaryCta={secondaryCta}
                logo={logo?.dark}
                utility={utility}
                mega={mega}
                locale={locale}
                labels={labels}
                onNavigate={() => setOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
      </Container>
    </header>
  )
}

function AccountMenu({ locale, labels }: { locale: string; labels: Labels }) {
  return (
    <AppLink href="/hesap" locale={locale} aria-label={labels.account} className="hidden h-11 items-center gap-1.5 rounded-md px-2.5 lg:h-9 text-small font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text md:inline-flex">
      <User aria-hidden className="size-4" />
      <span className="hidden xl:inline">{labels.account}</span>
    </AppLink>
  )
}

function ProductsMega({
  item,
  data,
  locale,
  labels,
}: {
  item: NavItem
  data: MegaData
  locale: string
  labels: Labels
}) {
  if (!data.families.length) {
    return (
      <div className="flex items-center justify-between gap-6">
        <p className="text-muted">{labels.catalogSoon}</p>
        {item.href ? (
          <AppLink href={item.href} locale={locale} className="text-small font-medium text-accent">
            {labels.allProducts}
          </AppLink>
        ) : null}
      </div>
    )
  }
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
      {data.families.map((family) => (
        <div key={family.href}>
          <NavigationMenu.Link asChild>
            <AppLink href={family.href} locale={locale} className="group block">
              <span className="text-h4 text-text group-hover:text-accent">{family.title}</span>
              {family.tagline ? (
                <span className="mt-1 block text-small text-muted">{family.tagline}</span>
              ) : null}
            </AppLink>
          </NavigationMenu.Link>
          <ul className="mt-4 space-y-1 border-t border-border pt-3">
            {family.products.map((p) => (
              <li key={p.href}>
                <NavigationMenu.Link asChild>
                  <AppLink
                    href={p.href}
                    locale={locale}
                    className="block rounded-sm py-1.5 text-small text-text/90 hover:text-accent"
                  >
                    {p.label}
                  </AppLink>
                </NavigationMenu.Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
      {item.href ? (
        <NavigationMenu.Link asChild>
          <AppLink
            href={item.href}
            locale={locale}
            className="bg-brand-pattern card-hover group relative hidden min-h-48 flex-col justify-end overflow-hidden rounded-lg border border-border p-6 hover:border-border-strong lg:flex"
          >
            <span className="text-h3 text-text">{labels.allProducts}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-small font-medium text-accent">
              <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </AppLink>
        </NavigationMenu.Link>
      ) : null}
    </div>
  )
}

function SimpleMega({
  item,
  links,
  locale,
  allLabel,
}: {
  item: NavItem
  links: NavLink[]
  locale: string
  allLabel?: string
}) {
  return (
    <div className="grid gap-x-10 gap-y-2 md:grid-cols-3">
      {links.map((l) => (
        <NavigationMenu.Link asChild key={l.href + l.label}>
          <AppLink
            href={l.href}
            locale={locale}
            target={l.newTab ? '_blank' : undefined}
            className="group block rounded-md p-3 transition-colors hover:bg-surface-2"
          >
            <span className="text-h4 text-text">{l.label}</span>
            {l.description ? (
              <span className="mt-0.5 block text-small text-muted">{l.description}</span>
            ) : null}
          </AppLink>
        </NavigationMenu.Link>
      ))}
      {allLabel && item.href ? (
        <NavigationMenu.Link asChild>
          <AppLink href={item.href} locale={locale} className="p-3 text-small font-medium text-accent">
            {allLabel} →
          </AppLink>
        </NavigationMenu.Link>
      ) : null}
    </div>
  )
}

function CustomMega({ item, locale }: { item: NavItem; locale: string }) {
  const columns = item.columns ?? []
  const featured = item.featured
  return (
    <div className={cn('grid gap-10', featured && 'lg:grid-cols-[minmax(0,1fr)_19rem]')}>
      <div className={cn('grid gap-x-10 gap-y-8', columns.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {columns.map((col, i) => (
          <div key={(col.title ?? '') + i}>
            {col.title ? <p className="text-eyebrow font-semibold uppercase text-muted">{col.title}</p> : null}
            <ul className={cn('space-y-1', col.title && 'mt-3 border-t border-border pt-3')}>
              {col.links.map((l) => (
                <li key={l.href + l.label}>
                  <NavigationMenu.Link asChild>
                    <AppLink
                      href={l.href}
                      locale={locale}
                      target={l.newTab ? '_blank' : undefined}
                      className="group block rounded-md px-2 py-2 -mx-2 transition-colors hover:bg-surface-2"
                    >
                      <span className="text-small font-medium text-text group-hover:text-accent">{l.label}</span>
                      {l.description ? <span className="mt-0.5 block text-small text-muted">{l.description}</span> : null}
                    </AppLink>
                  </NavigationMenu.Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {featured ? <FeaturedCard featured={featured} locale={locale} /> : null}
    </div>
  )
}

function FeaturedCard({ featured, locale }: { featured: NonNullable<NavItem['featured']>; locale: string }) {
  const body = (
    <>
      {featured.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={featured.image.url}
          alt={featured.image.alt}
          width={featured.image.width ?? undefined}
          height={featured.image.height ?? undefined}
          loading="lazy"
          decoding="async"
          className="mb-5 aspect-[16/9] w-full rounded-md border border-border object-cover"
        />
      ) : null}
      <span className="text-h4 text-text">{featured.title}</span>
      {featured.description ? <span className="mt-2 block text-small text-muted">{featured.description}</span> : null}
      {featured.link ? (
        <span className="mt-4 inline-flex items-center gap-1 text-small font-medium text-accent">
          {featured.link.label}
          <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </>
  )
  const cls = 'bg-brand-pattern group relative flex flex-col overflow-hidden rounded-lg border border-border p-6'
  return featured.link ? (
    <NavigationMenu.Link asChild>
      <AppLink
        href={featured.link.href}
        locale={locale}
        target={featured.link.newTab ? '_blank' : undefined}
        className={cn(cls, 'card-hover hover:border-border-strong')}
      >
        {body}
      </AppLink>
    </NavigationMenu.Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function MobileNav({
  items,
  cta,
  secondaryCta,
  logo,
  utility,
  mega,
  locale,
  labels,
  onNavigate,
}: {
  items: NavItem[]
  cta: NavLink
  secondaryCta?: NavLink | null
  logo?: PublicImage | null
  utility: Utility
  mega: MegaData
  locale: string
  labels: Labels
  onNavigate: () => void
}) {
  const childrenOf = (item: NavItem): NavLink[] =>
    item.mega === 'products'
      ? mega.families.map((f) => ({ label: f.title, href: f.href }))
      : item.mega === 'solutions'
        ? mega.solutions
        : item.mega === 'custom'
          ? [
              ...(item.columns ?? []).flatMap((col) => col.links),
              ...(item.featured?.link ? [{ ...item.featured.link, label: item.featured.title }] : []),
            ]
          : (item.children ?? [])

  const row = 'flex min-h-11 w-full font-semibold items-center justify-between py-3.5 text-h4 text-text'
  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-4">
      <div className="mb-4 flex h-12 items-center pr-14">
        <Logo locale={locale} label={labels.siteName} image={logo} onClick={onNavigate} />
      </div>
      <nav aria-label={labels.menu} className="flex-1">
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const kids = childrenOf(item)
            return (
              <li key={item.label}>
                {kids.length ? (
                  <details className="group">
                    <summary className={cn(row, 'cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden')}>
                      {item.label}
                      <ChevronDown
                        aria-hidden
                        className="size-4 text-muted transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <ul className="mb-3 space-y-0.5 border-l border-border pl-4">
                      {item.href ? (
                        <li>
                          <SheetClose asChild>
                            <AppLink href={item.href} locale={locale} onClick={onNavigate} className="block py-3 text-small font-medium text-accent">
                              {item.mega === 'products' ? labels.allProducts : item.mega === 'solutions' ? labels.allSolutions : item.label}
                            </AppLink>
                          </SheetClose>
                        </li>
                      ) : null}
                      {kids.map((k) => (
                        <li key={k.href + k.label}>
                          <SheetClose asChild>
                            <AppLink href={k.href} locale={locale} target={k.newTab ? '_blank' : undefined} onClick={onNavigate} className="block py-3 text-small text-muted hover:text-text">
                              {k.label}
                            </AppLink>
                          </SheetClose>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : item.href ? (
                  <SheetClose asChild>
                    <AppLink href={item.href} locale={locale} target={item.newTab ? '_blank' : undefined} onClick={onNavigate} className={row}>
                      {item.label}
                    </AppLink>
                  </SheetClose>
                ) : null}
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="mt-8 space-y-3">
        <Button asChild size="lg" className="w-full">
          <AppLink href={cta.href} locale={locale} target={cta.newTab ? '_blank' : undefined} onClick={onNavigate}>
            {cta.label}
          </AppLink>
        </Button>
        {secondaryCta ? (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <AppLink href={secondaryCta.href} locale={locale} target={secondaryCta.newTab ? '_blank' : undefined} onClick={onNavigate}>
              {secondaryCta.label}
            </AppLink>
          </Button>
        ) : null}
        {utility.links.length ? (
          <nav aria-label={labels.utility}>
            <ul className="flex flex-wrap gap-x-5">
              {utility.links.map((l) => (
                <li key={l.href + l.label}>
                  <AppLink href={l.href} locale={locale} target={l.newTab ? '_blank' : undefined} onClick={onNavigate} className="inline-flex min-h-11 items-center text-small text-muted hover:text-text">
                    {l.label}
                  </AppLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div className="flex items-center justify-between">
          {utility.account ? (
            <AppLink href="/hesap" locale={locale} onClick={onNavigate} className="inline-flex min-h-11 items-center gap-2 text-small text-muted hover:text-text">
              <User aria-hidden className="size-4" />
              {labels.account}
            </AppLink>
          ) : <span />}
          {utility.language ? <LanguageSwitcher onNavigate={onNavigate} /> : null}
        </div>

      </div>
    </div>
  )
}
