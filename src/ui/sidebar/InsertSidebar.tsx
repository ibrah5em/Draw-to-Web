/**
 * Insert sidebar (L-SBR-01, L-SBR-02).
 *
 * Three Radix Tabs — Sections / Components / Elements. The Sections and
 * Components tabs are driven by `presetsRegistry` (C7): the list of cards
 * comes from `Object.keys(presetsRegistry)`, grouped by category, so adding
 * a preset to the registry surfaces a card with no UI changes (L-SBR-02
 * DoD). Icons, labels, categories and tooltip copy are looked up via
 * {@link getPresetMeta}, which falls back to safe defaults for any preset
 * that hasn't been curated yet. The Elements tab lists primitives, which
 * are not in the registry.
 *
 * Cards are focusable `<button>`s with `title` tooltips, so the surface is
 * keyboard-navigable (Radix handles arrow-key tab nav; Tab/Shift+Tab moves
 * through cards). L-SBR-03 adds search, L-SBR-04 wires dnd-kit drag.
 */

import * as Tabs from '@radix-ui/react-tabs'
import {
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  type LucideIcon,
  Minus,
  MousePointerClick,
  Smile,
  SquareStack,
  Type,
} from 'lucide-react'
import { useMemo, type JSX } from 'react'

import { presetsRegistry, type PresetId } from '@document/presets'
import type { ElementType } from '@document/types'

import styles from './InsertSidebar.module.css'
import { getPresetMeta, type PresetCategory } from './presetMeta'

interface InsertItem<TId extends string> {
  readonly id: TId
  readonly label: string
  readonly description: string
  readonly Icon: LucideIcon
}

const ELEMENT_ITEMS: ReadonlyArray<InsertItem<ElementType>> = [
  {
    id: 'container',
    label: 'Container',
    description: 'Empty layout container.',
    Icon: SquareStack,
  },
  { id: 'text', label: 'Text', description: 'Text block.', Icon: Type },
  { id: 'image', label: 'Image', description: 'Image with alt text.', Icon: ImageIcon },
  {
    id: 'button',
    label: 'Button',
    description: 'Clickable button element.',
    Icon: MousePointerClick,
  },
  { id: 'link', label: 'Link', description: 'Anchor link.', Icon: LinkIcon },
  { id: 'icon', label: 'Icon', description: 'Inline SVG icon.', Icon: Smile },
  { id: 'list', label: 'List', description: 'Ordered or unordered list.', Icon: List },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule.', Icon: Minus },
]

const TAB_DEFS = [
  { value: 'sections', label: 'Sections' },
  { value: 'components', label: 'Components' },
  { value: 'elements', label: 'Elements' },
] as const

/** Group every registered preset id by its display category. */
function groupPresets(): Record<PresetCategory, ReadonlyArray<InsertItem<PresetId>>> {
  const groups: Record<PresetCategory, InsertItem<PresetId>[]> = { sections: [], components: [] }
  const ids = Object.keys(presetsRegistry) as PresetId[]
  for (const id of ids) {
    const meta = getPresetMeta(id)
    groups[meta.category].push({
      id,
      label: meta.label,
      description: meta.description,
      Icon: meta.Icon,
    })
  }
  for (const list of Object.values(groups)) list.sort((a, b) => a.label.localeCompare(b.label))
  return groups
}

function InsertCard<TId extends string>({ item }: { item: InsertItem<TId> }): JSX.Element {
  const { id, label, description, Icon } = item
  return (
    <button type="button" className={styles.card} title={description} data-insert-id={id}>
      <span className={styles.cardThumb} aria-hidden>
        <Icon size={26} className={styles.cardIcon} />
      </span>
      <span className={styles.cardLabel}>{label}</span>
    </button>
  )
}

function InsertGrid<TId extends string>({
  items,
}: {
  items: ReadonlyArray<InsertItem<TId>>
}): JSX.Element {
  if (items.length === 0) {
    return <p className={styles.empty}>Nothing here yet.</p>
  }
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
  const presetGroups = useMemo(() => groupPresets(), [])

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
          <InsertGrid items={presetGroups.sections} />
        </Tabs.Content>
        <Tabs.Content value="components">
          <InsertGrid items={presetGroups.components} />
        </Tabs.Content>
        <Tabs.Content value="elements">
          <InsertGrid items={ELEMENT_ITEMS} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
