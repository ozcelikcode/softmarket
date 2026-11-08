'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { initMegaNav, initSheet } from '@/lib/header-nav'

/**
 * The only client island of the header: sticky surface (scroll + portal light theme) and the DOM
 * controller for the server-rendered mega menu and mobile sheet. Children are server components.
 * No tailwind-merge here (none of these classes conflict).
 */
export function HeaderFrame({ logo, lightLogo, children }: { logo: ReactNode; lightLogo?: ReactNode; children: ReactNode }) {
  const pathname = usePathname()
  // Only portal pages open on a light surface (no hero): the transparent header must switch to light tokens there.
  // Every other page starts with a dark hero (PageHero default), so one rule keeps header and hero consistent.
  const light = /^\/(?:tr|en)\/(?:hesap|account)(?:\/|$)/.test(pathname)
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const header = ref.current
    const nav = header?.querySelector<HTMLElement>('[data-mega-nav]')
    if (!header) return
    const stopNav = nav ? initMegaNav(nav) : undefined
    const stopSheet = initSheet(header)
    return () => { stopNav?.(); stopSheet() }
  }, [pathname, children])

  const surface = scrolled
    ? 'border-border bg-bg/70 backdrop-blur-xl supports-[not(backdrop-filter:blur(1px))]:bg-bg'
    : light ? 'border-transparent bg-bg' : 'border-transparent bg-transparent'
  return (
    <header
      ref={ref}
      data-theme={light ? 'light' : 'dark'}
      className={`sticky top-0 z-40 w-full border-b text-text transition-[background-color,border-color,backdrop-filter] duration-300 ${surface}`}
    >
      <div className="mx-auto w-full px-5 sm:px-8 max-w-content flex h-16 items-center gap-6 lg:h-[4.5rem]">
        {light && lightLogo ? lightLogo : logo}
        {children}
      </div>
    </header>
  )
}
