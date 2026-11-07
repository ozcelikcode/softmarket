'use client'

import { ChevronDown, Menu, Search, User } from 'lucide-react'
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
import type { MegaData, NavItem, NavLink } from '@/lib/site'
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
}

type Props = {
  locale: string
  items: NavItem[]
  cta: NavLink
  mega: MegaData
  labels: Labels
}

const triggerCls =
  'group inline-flex h-10 items-center gap-1 rounded-md px-3 text-small font-medium text-muted transition-colors hover:text-text data-[state=open]:text-text'

export function HeaderShell({ locale, items, cta, mega, labels }: Props) {
  const pathname = usePathname()
  // Support and portal pages open with a light hero: the transparent header must switch to light tokens there.
  const light = /^\/(?:tr|en)\/(?:hesap|account|destek|support)(?:\/|$)/.test(pathname)
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
      <Container size="wide" className="flex h-16 items-center gap-6 lg:h-[4.5rem]">
        <Logo locale={locale} label={labels.siteName} />

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
                        <Container size="wide" className="py-8">
                          {item.mega === 'products' ? (
                            <ProductsMega
                              item={item}
                              data={mega}
                              locale={locale}
                              labels={labels}
                            />
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
          <AppLink
            href="/ara"
            locale={locale}
            aria-label={labels.search}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Search aria-hidden className="size-[18px]" />
          </AppLink>
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <AccountMenu locale={locale} labels={labels} />
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
                className="inline-flex size-10 items-center justify-center rounded-md text-text hover:bg-surface-2 lg:hidden"
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
    <AppLink href="/hesap" locale={locale} aria-label={labels.account} className="hidden h-9 items-center gap-1.5 rounded-md px-2.5 text-small font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text md:inline-flex">
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
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
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
                    className="block rounded-sm py-1 text-small text-muted hover:text-text"
                  >
                    {p.label}
                  </AppLink>
                </NavigationMenu.Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {item.href ? (
        <div className="flex items-end md:col-span-3 xl:col-span-4">
          <NavigationMenu.Link asChild>
            <AppLink href={item.href} locale={locale} className="text-small font-medium text-accent hover:underline">
              {labels.allProducts} →
            </AppLink>
          </NavigationMenu.Link>
        </div>
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

function MobileNav({
  items,
  cta,
  mega,
  locale,
  labels,
  onNavigate,
}: {
  items: NavItem[]
  cta: NavLink
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
        : (item.children ?? [])

  const row = 'flex w-full font-semibold items-center justify-between py-3.5 text-h4 text-text'
  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 pb-8 pt-16">
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
                            <AppLink href={item.href} locale={locale} onClick={onNavigate} className="block py-2 text-small font-medium text-accent">
                              {item.mega === 'products' ? labels.allProducts : item.mega === 'solutions' ? labels.allSolutions : item.label}
                            </AppLink>
                          </SheetClose>
                        </li>
                      ) : null}
                      {kids.map((k) => (
                        <li key={k.href + k.label}>
                          <SheetClose asChild>
                            <AppLink href={k.href} locale={locale} target={k.newTab ? '_blank' : undefined} onClick={onNavigate} className="block py-2 text-small text-muted hover:text-text">
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
        <div className="flex items-center justify-between">
          <AppLink href="/hesap" locale={locale} onClick={onNavigate} className="inline-flex items-center gap-2 text-small text-muted hover:text-text">
            <User aria-hidden className="size-4" />
            {labels.account}
          </AppLink>
          <LanguageSwitcher onNavigate={onNavigate} />
        </div>

      </div>
    </div>
  )
}
