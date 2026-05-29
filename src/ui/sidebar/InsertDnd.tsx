/**
 * Drag-and-drop context for the Insert sidebar (L-SBR-04).
 *
 * Wraps the editor body in a dnd-kit `DndContext` and renders a
 * `DragOverlay` that paints a 1:1 preview of the dragged Insert card.
 * The drop side (L-CAN-12) is wired separately on the Canvas; this
 * provider stays drop-agnostic so the preview works even when no
 * target is configured yet.
 */

import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useMemo, useState, type JSX, type ReactNode } from 'react'

import { presetsRegistry, type PresetId } from '@document/presets'

import styles from './InsertSidebar.module.css'
import { ELEMENT_ITEMS, type InsertItem, type InsertKind, insertDraggableId } from './InsertSidebar'
import { getPresetMeta } from './presetMeta'

interface ParsedDragId {
  readonly kind: InsertKind
  readonly itemId: string
}

/** `insert:preset:hero-centered` → `{ kind: 'preset', itemId: 'hero-centered' }`. */
function parseDraggableId(raw: string | number | null | undefined): ParsedDragId | null {
  if (typeof raw !== 'string') return null
  const parts = raw.split(':')
  if (parts.length !== 3 || parts[0] !== 'insert') return null
  if (parts[1] !== 'preset' && parts[1] !== 'element') return null
  return { kind: parts[1], itemId: parts[2] }
}

function elementItemFor(itemId: string): InsertItem | null {
  return ELEMENT_ITEMS.find((item) => item.id === itemId) ?? null
}

function presetItemFor(itemId: string): InsertItem | null {
  if (!(itemId in presetsRegistry)) return null
  const meta = getPresetMeta(itemId as PresetId)
  return {
    id: itemId,
    kind: 'preset',
    label: meta.label,
    description: meta.description,
    Icon: meta.Icon,
  }
}

function resolveItem(parsed: ParsedDragId): InsertItem | null {
  return parsed.kind === 'preset' ? presetItemFor(parsed.itemId) : elementItemFor(parsed.itemId)
}

/** A floating chip used as the cursor-follower while a card is dragged. */
function DragPreview({ item }: { item: InsertItem }): JSX.Element {
  const { Icon, label } = item
  return (
    <div className={styles.dragPreview} role="presentation">
      <span className={styles.dragPreviewIcon} aria-hidden>
        <Icon size={18} />
      </span>
      <span>{label}</span>
    </div>
  )
}

/**
 * Provides the editor-wide DndContext + DragOverlay used by Insert cards.
 * Drop targets attach via `useDroppable` elsewhere (L-CAN-12).
 */
export function InsertDndProvider({ children }: { children: ReactNode }): JSX.Element {
  const [activeItem, setActiveItem] = useState<InsertItem | null>(null)

  const handleDragStart = useMemo(
    () =>
      (event: DragStartEvent): void => {
        const parsed = parseDraggableId(event.active.id)
        if (!parsed) return
        setActiveItem(resolveItem(parsed))
      },
    []
  )

  const handleDragEnd = useMemo(
    () =>
      (_event: DragEndEvent): void => {
        setActiveItem(null)
      },
    []
  )

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveItem(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeItem ? <DragPreview item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

export { insertDraggableId }
