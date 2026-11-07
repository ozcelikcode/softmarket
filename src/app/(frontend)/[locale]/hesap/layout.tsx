import type { ReactNode } from 'react'
import { DynamicSecurity } from '@/components/security/dynamic-security'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <DynamicSecurity>{children}</DynamicSecurity>
}
