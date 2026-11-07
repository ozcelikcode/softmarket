import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { NonceProvider } from './nonce-provider'

/** Use only on dynamic pages. Reading headers in the locale layout would disable ISR. */
export async function DynamicSecurity({ children }: { children: ReactNode }) {
  return <NonceProvider nonce={(await headers()).get('x-nonce') || undefined}>{children}</NonceProvider>
}
