import { contentSecurityPolicy } from '@/lib/csp'

/** Production public-page CSP (static policy), for allowlist assertions. */
export const csp = () => contentSecurityPolicy()
