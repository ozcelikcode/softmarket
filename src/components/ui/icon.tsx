import {
  Boxes, Cloud, Cpu, Database, Film, Gauge, Globe, Layers, LifeBuoy, Lock, Network, Package, Shield,
  ShieldCheck, Sparkles, Workflow, Zap, type LucideIcon,
} from 'lucide-react'

import { normalizeIconName, type IconName } from '@/lib/icon-names'

// Typed by IconName: adding a name to ICON_NAMES without an icon here fails typecheck.
const ICONS: Record<IconName, LucideIcon> = {
  boxes: Boxes, cloud: Cloud, cpu: Cpu, database: Database, film: Film, gauge: Gauge, globe: Globe,
  layers: Layers, 'life-buoy': LifeBuoy, lock: Lock, network: Network, package: Package, shield: Shield,
  'shield-check': ShieldCheck, sparkles: Sparkles, workflow: Workflow, zap: Zap,
}

/** Maps a CMS icon name (lucide id) to a curated icon set; unknown names fall back. */
export function NamedIcon({ name, fallback = Boxes, className }: { name?: string | null; fallback?: LucideIcon; className?: string }) {
  const id = normalizeIconName(name)
  const Icon = (id && ICONS[id]) || fallback
  return <Icon aria-hidden className={className} />
}
