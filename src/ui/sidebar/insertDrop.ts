/**
 * Insert-sidebar drop helpers (L-CAN-12 — drop side of L-SBR-04).
 *
 * Drop targets live on every container the canvas renders. Their dnd-kit
 * id is `drop:container:{elementId}`; the sidebar's drag id is
 * `insert:{kind}:{itemId}`. {@link buildInsertOp} maps an `(active, over)`
 * pair to the document operation that will land the new node — either
 * `insertPreset` for a preset card or `insertElement` for a primitive.
 *
 * Kept pure so it can be unit-tested without a DnD harness; the actual
 * `dispatch` happens in `InsertDnd.tsx`.
 */

import type { InsertElementOp, InsertPresetOp, Operation } from '@document/operations'
import { presetsRegistry, type PresetId } from '@document/presets'
import type { ElementId, ElementNode, ElementType } from '@document/types'

const DROP_PREFIX = 'drop:container:'
const DRAG_PREFIX = 'insert:'

/** dnd-kit id used by canvas container drop targets. */
export function containerDropId(elementId: ElementId): string {
  return `${DROP_PREFIX}${elementId}`
}

/** Reverse {@link containerDropId}; returns `null` if `raw` isn't a container drop id. */
export function parseContainerDropId(raw: string | number | null | undefined): ElementId | null {
  if (typeof raw !== 'string' || !raw.startsWith(DROP_PREFIX)) return null
  return raw.slice(DROP_PREFIX.length)
}

/** Find the container parent + child index of `id`, or `null` if not found. */
function findParentAndIndex(
  node: ElementNode,
  id: ElementId
): { parentId: ElementId; index: number } | null {
  if (node.type !== 'container') return null
  for (let i = 0; i < node.children.length; i += 1) {
    const child = node.children[i]!
    if (child.id === id) return { parentId: node.id, index: i + 1 }
    const found = findParentAndIndex(child, id)
    if (found) return found
  }
  return null
}

/**
 * When an Insert drag ends over a *rendered child* rather than a container
 * drop target, resolve the container to drop into and the index just after
 * that child. dnd-kit reports `over` as the topmost droppable, which — because
 * a container and its sortable children overlap — is often a sibling element,
 * not the `drop:container:` target. Returns `null` when `overId` isn't a bare
 * element id, or the element has no container parent (e.g. the root).
 */
export function resolveChildDropTarget(
  overId: string | number | null | undefined,
  tree: ElementNode
): { parentId: ElementId; index: number } | null {
  if (typeof overId !== 'string') return null
  if (overId.startsWith(DROP_PREFIX) || overId.startsWith(DRAG_PREFIX)) return null
  return findParentAndIndex(tree, overId)
}

interface ParsedDrag {
  readonly kind: 'preset' | 'element'
  readonly itemId: string
}

function parseDragId(raw: string | number | null | undefined): ParsedDrag | null {
  if (typeof raw !== 'string' || !raw.startsWith(DRAG_PREFIX)) return null
  const parts = raw.slice(DRAG_PREFIX.length).split(':')
  if (parts.length !== 2) return null
  const [kind, itemId] = parts
  if (kind !== 'preset' && kind !== 'element') return null
  return { kind, itemId }
}

/**
 * Build a minimal valid `ElementNode` for the given primitive type. Used
 * when a card from the Elements tab is dropped onto a container.
 */
export function createPrimitive(type: ElementType, id: ElementId): ElementNode {
  switch (type) {
    case 'container':
      return {
        type: 'container',
        id,
        name: 'Container',
        layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
        style: { base: {} },
        children: [],
      }
    case 'text':
      return { type: 'text', id, tag: 'p', content: 'New text', style: { base: {} } }
    case 'image':
      return {
        type: 'image',
        id,
        alt: '',
        style: { base: { width: '100%', maxWidth: '320px' } },
      }
    case 'button':
      return { type: 'button', id, content: 'Button', style: { base: {} } }
    case 'link':
      return { type: 'link', id, content: 'Link', href: '#', style: { base: {} } }
    case 'icon':
      return { type: 'icon', id, name: 'sparkles', decorative: true, style: { base: {} } }
    case 'list':
      return {
        type: 'list',
        id,
        ordered: false,
        items: ['Item one', 'Item two'],
        style: { base: {} },
      }
    case 'divider':
      return { type: 'divider', id, orientation: 'horizontal', style: { base: {} } }
  }
}

/**
 * Compute the operation that should run for a given drag/drop pair.
 *
 * @param activeId  - dnd-kit `active.id` (the dragged sidebar card).
 * @param overId    - dnd-kit `over.id` (the container drop target, if any).
 * @param generateId - id factory used to mint a fresh `ElementId` for primitives.
 * @param index     - optional position among the parent's children; appended
 *   when omitted (used when resolving a drop over a child to a precise slot).
 * @returns The operation to dispatch, or `null` when the drop should be ignored.
 */
export function buildInsertOp(
  activeId: string | number | null | undefined,
  overId: string | number | null | undefined,
  generateId: () => ElementId,
  index?: number
): Operation | null {
  const parent = parseContainerDropId(overId)
  if (parent === null) return null
  const drag = parseDragId(activeId)
  if (drag === null) return null

  if (drag.kind === 'preset') {
    if (!(drag.itemId in presetsRegistry)) return null
    const op: InsertPresetOp = {
      kind: 'insertPreset',
      parentId: parent,
      presetId: drag.itemId as PresetId,
      index,
    }
    return op
  }

  const node = createPrimitive(drag.itemId as ElementType, generateId())
  const op: InsertElementOp = { kind: 'insertElement', parentId: parent, node, index }
  return op
}
