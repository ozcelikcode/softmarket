import { defineRouting } from 'next-intl/routing'

import { buildPathnames } from './paths'

export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  pathnames: buildPathnames(),
})

export type Locale = (typeof routing.locales)[number]
