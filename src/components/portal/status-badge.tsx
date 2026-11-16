import { Badge } from '@/components/ui/badge'
import type { LicenseDisplayState } from '@/lib/licenses/state'

const LICENSE_VARIANT: Record<LicenseDisplayState, 'success' | 'warning' | 'danger' | 'neutral' | 'accent'> = {
  active: 'success',
  expiring: 'warning',
  expired: 'danger',
  revoked: 'danger',
  suspended: 'neutral',
  upcoming: 'accent',
}

export const LicenseBadge = ({ state, label }: { state: LicenseDisplayState; label: string }) => (
  <Badge variant={LICENSE_VARIANT[state]}>{label}</Badge>
)

const TICKET_VARIANT = { open: 'accent', pending: 'warning', resolved: 'success', closed: 'neutral' } as const

export const TicketBadge = ({ status, label }: { status: keyof typeof TICKET_VARIANT; label: string }) => (
  <Badge variant={TICKET_VARIANT[status] ?? 'neutral'}>{label}</Badge>
)

const ORDER_VARIANT = { pending: 'warning', paid: 'success', fulfilled: 'success', failed: 'danger', refunded: 'neutral', cancelled: 'neutral' } as const

export const OrderBadge = ({ status, label }: { status: keyof typeof ORDER_VARIANT; label: string }) => (
  <Badge variant={ORDER_VARIANT[status] ?? 'neutral'}>{label}</Badge>
)
