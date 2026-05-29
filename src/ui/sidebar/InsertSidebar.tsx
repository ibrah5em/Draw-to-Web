/**
 * Insert sidebar (L-SBR-01..04).
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
 * A search field above the tabs (L-SBR-03) filters every category on
 * label / id / description; the active tab's grid reflects the match.
 *
 * Each card is a dnd-kit `useDraggable` (L-SBR-04) — the DragOverlay in
 * `App.tsx` paints a 1:1 preview that follows the cursor. L-CAN-12 wires
 * the drop targets on the canvas.
 *
 * Cards are focusable `<button>`s with `title` tooltips, so the surface is
 * keyboard-navigable (Radix handles arrow-key tab nav; Tab/Shift+Tab moves
 * through cards).
 */

import { useDraggable } from '@dnd-kit/core'
import * as Tabs from '@radix-ui/react-tabs'
import {
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  type LucideIcon,
  Minus,
  MousePointerClick,
  Search,
  Smile,
  SquareStack,
  Type,
  X,
} from 'lucide-react'
import { useId, useMemo, useState, type JSX } from 'react'

import { presetsRegistry, type PresetId } from '@document/presets'
import type { ElementType } from '@document/types'

import styles from './InsertSidebar.module.css'
import { getPresetMeta, type PresetCategory } from './presetMeta'

/** Kind of thing a draggable card carries — disambiguates primitives from presets. */
export type InsertKind = 'preset' | 'element'

/** Shape carried by every draggable card. Mirrored in `useDraggable` data. */
export interface InsertItem<TId extends string = string> {
  readonly id: TId
  readonly kind: InsertKind
  readonly label: string
  readonly description: string
  readonly Icon: LucideIcon
}

export const ELEMENT_ITEMS: ReadonlyArray<InsertItem<ElementType>> = [
  {
    id: 'container',
    kind: 'element',
    label: 'Container',
    description: 'Empty layout container.',
    Icon: SquareStack,
  },
  { id: 'text', kind: 'element', label: 'Text', description: 'Text block.', Icon: Type },
  {
    id: 'image',
    kind: 'element',
    label: 'Image',
    description: 'Image with alt text.',
    Icon: ImageIcon,
  },
  {
    id: 'button',
    kind: 'element',
    label: 'Button',
    description: 'Clickable button element.',
    Icon: MousePointerClick,
  },
  { id: 'link', kind: 'element', label: 'Link', description: 'Anchor link.', Icon: LinkIcon },
  { id: 'icon', kind: 'element', label: 'Icon', description: 'Inline SVG icon.', Icon: Smile },
  {
    id: 'list',
    kind: 'element',
    label: 'List',
    description: 'Ordered or unordered list.',
    Icon: List,
  },
  {
    id: 'divider',
    kind: 'element',
    label: 'Divider',
    description: 'Horizontal rule.',
    Icon: Minus,
  },
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
      kind: 'preset',
      label: meta.label,
      description: meta.description,
      Icon: meta.Icon,
    })
  }
  for (const list of Object.values(groups)) list.sort((a, b) => a.label.localeCompare(b.label))
  return groups
}

/** Case-insensitive substring match across an item's label, id, and description. */
function matchesQuery(item: InsertItem, query: string): boolean {
  if (query === '') return true
  const q = query.toLowerCase()
  return (
    item.label.toLowerCase().includes(q) ||
    item.id.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q)
  )
}

/** Stable dnd-kit draggable id for a card. Lets the drop target read kind+id back. */
export function insertDraggableId(item: InsertItem): string {
  return `insert:${item.kind}:${item.id}`
}

function InsertCard({ item }: { item: InsertItem }): JSX.Element {
  const { id, label, description, Icon, kind } = item
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: insertDraggableId(item),
    data: { source: 'insert', kind, itemId: id },
  })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.card}
      title={description}
      data-insert-id={id}
      data-insert-kind={kind}
      data-dragging={isDragging || undefined}
      {...listeners}
      {...attributes}
    >
      <span className={styles.cardThumb} aria-hidden>
        <Icon size={26} className={styles.cardIcon} />
      </span>
      <span className={styles.cardLabel}>{label}</span>
    </button>
  )
}

function InsertGrid({ items }: { items: ReadonlyArray<InsertItem> }): JSX.Element {
  if (items.length === 0) {
    return <p className={styles.empty}>No matches.</p>
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
  const [query, setQuery] = useState('')
  const searchId = useId()

  const filtered = useMemo(
    () => ({
      sections: presetGroups.sections.filter((item) => matchesQuery(item, query)),
      components: presetGroups.components.filter((item) => matchesQuery(item, query)),
      elements: ELEMENT_ITEMS.filter((item) => matchesQuery(item, query)),
    }),
    [presetGroups, query]
  )

  return (
    <Tabs.Root defaultValue="sections" className={styles.panel}>
      <div className={styles.searchRow}>
        <label htmlFor={searchId} className={styles.searchIcon} aria-hidden>
          <Search size={14} />
        </label>
        <input
          id={searchId}
          type="search"
          className={styles.searchInput}
          placeholder="Search insert items"
          aria-label="Search insert items"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query !== '' && (
          <button
            type="button"
            className={styles.searchClear}
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

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
          <InsertGrid items={filtered.sections} />
        </Tabs.Content>
        <Tabs.Content value="components">
          <InsertGrid items={filtered.components} />
        </Tabs.Content>
        <Tabs.Content value="elements">
          <InsertGrid items={filtered.elements} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  )
}
