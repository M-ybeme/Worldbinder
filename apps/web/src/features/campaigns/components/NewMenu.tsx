import { MenuButton, type MenuButtonItem } from '@worldbinder/ui'
import { ChevronDown, Plus } from 'lucide-react'

export type NewMenuItem = MenuButtonItem

/** The Dashboard's "+ New" menu — the shared MenuButton with the primary
 * button styling and a "Create new" menu name. */
export function NewMenu({ items }: { items: NewMenuItem[] }) {
  return (
    <MenuButton
      buttonClassName="wb-button wb-button--primary"
      menuLabel="Create new"
      items={items}
      label={
        <>
          <Plus size={16} aria-hidden="true" />
          New
          <ChevronDown size={14} aria-hidden="true" />
        </>
      }
    />
  )
}
