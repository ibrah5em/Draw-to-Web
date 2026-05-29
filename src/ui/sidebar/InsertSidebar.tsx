/**
 * Insert sidebar (L-SBR-01).
 *
 * Three Radix Tabs — Sections / Components / Elements — each listing the
 * draggable items the user can drop onto the canvas. Each item carries a
 * lucide icon and a label. Cards are focusable `<button>`s so the whole
 * surface is keyboard-navigable (arrow keys move between tabs via Radix;
 * Tab/Shift+Tab moves through cards within the active tab).
 *
 * L-SBR-02 (registry-driven cards), L-SBR-03 (search) and L-SBR-04 (drag
 * via dnd-kit) hang off this skeleton.
 */

import * as Tabs from '@radix-ui/react-tabs'
import {
  AppWindow,
  CreditCard,
  Image as ImageIcon,
  LayoutGrid,
  Layout as LayoutIcon,
  Link as LinkIcon,
  List,
  Megaphone,
  Minus,
  MousePointerClick,
  Navigation,
  PanelBottom,
  PanelTop,
  Smile,
  SquareStack,
  Type,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { JSX } from 'react'

import type { PresetId } from '@document/presets'
import type { ElementType } from '@document/types'

import styles from './InsertSidebar.module.css'

type IconType = LucideIcon

interface InsertItem<TId extends string> {
  readonly id: TId
  readonly label: string
  readonly Icon: IconType
}

const SECTION_ITEMS: ReadonlyArray<InsertItem<PresetId>> = [
  { id: 'nav-fixed', label: 'Nav', Icon: Navigation },
  { id: 'hero-centered', label: 'Hero (centered)', Icon: PanelTop },
  { id: 'hero-split', label: 'Hero (split)', Icon: LayoutIcon },
  { id: 'cta-banner', label: 'CTA banner', Icon: Megaphone },
  { id: 'footer-simple', label: 'Footer', Icon: PanelBottom },
  { id: 'footer-columns', label: 'Footer (columns)', Icon: AppWindow },
]

const COMPONENT_ITEMS: ReadonlyArray<InsertItem<PresetId>> = [
  { id: 'cards-grid-3col', label: 'Cards grid (3)', Icon: LayoutGrid },
  { id: 'card-basic', label: 'Card', Icon: CreditCard },
]

const ELEMENT_ITEMS: ReadonlyArray<InsertItem<ElementType>> = [
  { id: 'container', label: 'Container', Icon: SquareStack },
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'image', label: 'Image', Icon: ImageIcon },
  { id: 'button', label: 'Button', Icon: MousePointerClick },
  { id: 'link', label: 'Link', Icon: LinkIcon },
  { id: 'icon', label: 'Icon', Icon: Smile },
  { id: 'list', label: 'List', Icon: List },
  { id: 'divider', label: 'Divider', Icon: Minus },
]

const TAB_DEFS = [
  { value: 'sections', label: 'Sections' },
  { value: 'components', label: 'Components' },
  { value: 'elements', label: 'Elements' },
] as const

function InsertCard<TId extends string>({ item }: { item: InsertItem<TId> }): JSX.Element {
  const { label, Icon } = item
  return (
    <button type="button" className={styles.card} title={label}>
      <Icon size={22} className={styles.cardIcon} />
      <span className={styles.cardLabel}>{label}</span>
    </button>
  )
}

function InsertGrid<TId extends string>({
  items,
}: {
  items: ReadonlyArray<InsertItem<TId>>
}): JSX.Element {
  return (
    <div className={styles.content}>
      {items.map((item) => (
        <InsertCard key={item.id} item={item} />
      ))}
    </div>
  )
}

/** Three-tab Insert sidebar — Sections / Components / Elements. */
export function InsertSidebar(): JSX.Element {
  return (
    <Tabs.Root defaultValue="sections" className={styles.panel}>
      <div className={styles.header}>
        <Tabs.List className={styles.tabs} aria-label="Insert categories">
          {TAB_DEFS.map((tab) => (
            <Tabs.Trigger key={tab.value} value={tab.value} className={styles.tab}>
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>

      <div className={styles.body}>
        <Tabs.Content value="sections">
          <InsertGrid items={SECTION_ITEMS} />
        </Tabs.Content>
        <Tabs.Content value="components">
          <InsertGrid items={COMPONENT_ITEMS} />
        </Tabs.Content>
        <Tabs.Content value="elements">
          <InsertGrid items={ELEMENT_ITEMS} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
