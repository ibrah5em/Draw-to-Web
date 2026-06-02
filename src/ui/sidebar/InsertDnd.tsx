/**
 * Drag-and-drop context for the Insert sidebar (L-SBR-04, L-CAN-12).
 *
 * Wraps the editor body in a dnd-kit `DndContext` and renders a
 * `DragOverlay` that paints a 1:1 preview of the dragged Insert card.
 * On drop, {@link buildInsertOp} maps the (active, over) pair to a
 * document operation and dispatches it, materialising the preset
 * subtree or primitive under the targeted container.
 */

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { nanoid } from 'nanoid'
import { useMemo, useState, type JSX, type ReactNode } from 'react'

import { presetsRegistry, type PresetId } from '@document/presets'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { buildReorderOp } from '../canvas/sortableReorder'

import { buildInsertOp, containerDropId, resolveChildDropTarget } from './insertDrop'
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

/**
 * Pointer-first collision detection. Canvas containers and their sortable
 * children overlap, so the default `rectIntersection` (driven by the dragged
 * card's rect) frequently picks the wrong target. `pointerWithin` resolves to
 * what's under the cursor; we fall back to `rectIntersection` only when the
 * pointer is outside every droppable (e.g. dropping into a gap).
 */
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args)
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
      (event: DragEndEvent): void => {
        setActiveItem(null)
        const over = event.over?.id ?? null
        const tree = useDocumentStore.getState().document.tree
        const generateId = (): string => nanoid(8)

        let insertOp = buildInsertOp(event.active.id, over, generateId)
        // `over` may have resolved to a rendered child rather than the
        // container drop target — retry against that child's parent + slot.
        if (insertOp === null && parseDraggableId(event.active.id) !== null) {
          const target = resolveChildDropTarget(over, tree)
          if (target !== null) {
            insertOp = buildInsertOp(
              event.active.id,
              containerDropId(target.parentId),
              generateId,
              target.index
            )
          }
        }
        if (insertOp !== null) {
          dispatch(insertOp)
          return
        }
        const reorderOp = buildReorderOp(event.active.id, over, tree)
        if (reorderOp !== null) dispatch(reorderOp)
      },
    []
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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
