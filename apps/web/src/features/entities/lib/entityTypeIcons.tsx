import {
  BookOpen,
  Building2,
  CalendarDays,
  Flag,
  MapPin,
  Package,
  PawPrint,
  Route,
  Shapes,
  Star,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { EntityType } from '@worldbinder/contracts'

// Design doc §17.1's conceptual mapping, made concrete. `faction` and
// `quest` both offered "flag" as one of two suggested options — assigned
// to faction, quest gets its other suggested option (route) so no two
// entity types share an icon.
export const ENTITY_TYPE_ICONS: Record<EntityType, LucideIcon> = {
  character: User,
  location: MapPin,
  faction: Flag,
  organization: Building2,
  item: Package,
  deity: Star,
  creature: PawPrint,
  event: CalendarDays,
  quest: Route,
  lore: BookOpen,
  custom: Shapes,
}

export function EntityTypeIcon({ type, size = 16 }: { type: EntityType; size?: number }) {
  const Icon = ENTITY_TYPE_ICONS[type]
  return <Icon size={size} aria-hidden="true" />
}
