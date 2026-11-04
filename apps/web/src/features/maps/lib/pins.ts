import type { MapPinSummary } from '@worldbinder/contracts'

/** What a pin is called: its own label, else its linked entry's name. */
export function pinLabel(pin: MapPinSummary): string {
  return pin.label ?? pin.locationEntityName ?? 'Unlabeled pin'
}
