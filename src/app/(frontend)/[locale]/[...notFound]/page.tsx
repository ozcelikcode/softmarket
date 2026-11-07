import { notFound } from 'next/navigation'

/**
 * Unmatched URLs under a valid locale: render the localized [locale]/not-found (inside the layout with
 * header and footer) instead of the layout-less global-not-found document.
 */
export default function UnmatchedPage(): never {
  notFound()
}
