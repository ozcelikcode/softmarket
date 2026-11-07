import type { Block } from 'payload'

import { blockSettings } from '@/fields/block-settings'

import { blockMeta } from './meta'

/**
 * Position of the route's own list on a system page (pages.systemKey, F6): product catalog with family
 * filter, news with pagination, solutions, customers, careers, partners, support hub, contact details + form.
 * The list itself is a movable block; it has no content fields. Pages only: it renders nothing elsewhere.
 * A system page without this block shows the list right under the hero; hide it via Appearance > Hide.
 */
export const Listing: Block = {
  slug: 'listing',
  interfaceName: 'ListingBlock',
  ...blockMeta('listing', ['Sayfa listesi (sistem sayfası)', 'Page list (system page)'], ['Sayfa listeleri', 'Page lists'], 'catalog'),
  fields: [blockSettings('listing')],
}
