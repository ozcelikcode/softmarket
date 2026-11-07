import NextLink from 'next/link'
import type { ComponentProps } from 'react'

import { localizedHref } from '@/i18n/paths'

type Props = Omit<ComponentProps<typeof NextLink>, 'href'> & {
  /** Canonical (Turkish) path such as /urunler/x, or an absolute/external URL. */
  href: string
  locale: string
}

/** Locale-aware link for CMS-provided and canonical paths. */
export function AppLink({ href, locale, target, rel, ...props }: Props) {
  const resolved = localizedHref(href, locale)
  const external = /^[a-z][a-z\d+.-]*:/i.test(resolved)
  const safeRel = target === '_blank' ? [...new Set(`${rel ?? ''} noopener noreferrer`.split(/\s+/))].join(' ').trim() : rel
  return external ? (
    <a href={resolved} target={target} rel={safeRel} {...(props as ComponentProps<'a'>)} />
  ) : (
    <NextLink href={resolved} target={target} rel={safeRel} {...props} />
  )
}
