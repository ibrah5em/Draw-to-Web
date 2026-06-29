/**
 * Draw-to-create surface (the canvas wiring for the draw gesture).
 *
 * When draw mode is on, this overlay sits over the `.page` box and turns a
 * pointer-drag into a real element:
 *
 *   1. On press it picks the deepest CONTAINER under the cursor as the target
 *      and reads that container's own column geometry.
 *   2. The drag paints a rectangle with a LIVE SNAP PREVIEW — the target's
 *      columns light up, snap guides mark the edges, and a label shows the
 *      span + size. Pixels never leave this component.
 *   3. On release the rectangle is normalised to the target's box,
 *      `interpretRectangle` guesses the kind and `snapToGrid` resolves the
 *      placement; an empty flex target is auto-switched to a grid so the
 *      element lands in its columns; then a normal `insertElement` op is
 *      dispatched. Nothing else writes to the model.
 *   4. A {@link DrawTypePicker} opens on the new element (best guess + every
 *      alternative, confidence, hint) so a wrong guess is a one-click fix.
 *
 * All real logic lives in the pure `@draw` modules; this component only
 * measures the DOM and dispatches existing operations.
 */

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { nanoid } from 'nanoid'

import {
  columnsFromTemplate,
  decorateDrawnNode,
  drawnKindToElementType,
  headingTagFor,
  interpretRectangle,
  snapToGrid,
  withGridPlacement,
  type DrawnElementKind,
  type ElementTypeGuess,
  type GridPlacement,
  type NormalizedRect,
  type RectangleShape,
} from '@draw'
import type { Operation } from '@document/operations'
import type { BreakpointKey, ContainerNode, ElementId, ElementNode } from '@document/types'
import { dispatch, dispatchBatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { createPrimitive } from '../sidebar/insertDrop'
import { DrawTypePicker } from './DrawTypePicker'
import styles from './DrawSurface.module.css'

/** Minimum drag extent (px) below which a gesture counts as a click, not a draw. */
const MIN_DRAW_PX = 8

/** Client-space rectangle. */
interface PxRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** The container a gesture commits to on press, with its grid geometry. */
interface Target {
  readonly id: ElementId
  readonly node: ContainerNode
  readonly rect: DOMRect
  readonly columns: number
}

interface DragState {
  readonly startX: number
  readonly startY: number
  readonly overlay: DOMRect
  readonly target: Target
  current: { x: number; y: number } | null
}

/** Live preview geometry (overlay-relative pixels). */
interface Preview {
  readonly rect: PxRect
  readonly targetRect: PxRect
  readonly columns: number
  readonly placement: GridPlacement
  readonly label: string
}

/** A just-inserted drawn element awaiting type confirmation. */
interface PendingDraw {
  readonly id: ElementId
  readonly parentId: ElementId
  readonly index: number
  readonly placement: GridPlacement
  readonly breakpoint: BreakpointKey
  readonly guess: ElementTypeGuess
  readonly kind: DrawnElementKind
}

// --- pure-ish tree/DOM helpers ---------------------------------------------

/** Collect the ids of every container in the tree. */
function collectContainerIds(node: ElementNode, into: Set<ElementId>): Set<ElementId> {
  if (node.type === 'container') {
    into.add(node.id)
    for (const child of node.children) collectContainerIds(child, into)
  }
  return into
}

/** Find a node by id. */
function findNode(node: ElementNode, id: ElementId): ElementNode | null {
  if (node.id === id) return node
  if (node.type === 'container') {
    for (const child of node.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return null
}

/** Whether the tree already contains an `<h1>` (drives heading-tag choice). */
function treeHasH1(node: ElementNode): boolean {
  if (node.type === 'text' && node.tag === 'h1') return true
  if (node.type === 'container') return node.children.some(treeHasH1)
  return false
}

/** A container's column count: its own grid if gridded, else the 12-col default. */
function targetColumns(node: ContainerNode): number {
  if (node.layout.base.mode === 'grid') {
    return columnsFromTemplate(node.layout.base.gridTemplateColumns) ?? 12
  }
  return 12
}

/** Normalised vertical centres of a container's direct children, top-to-bottom. */
function measureSiblingCenters(containerEl: HTMLElement, rect: DOMRect): number[] {
  if (rect.height <= 0) return []
  const centers: number[] = []
  for (const el of containerEl.querySelectorAll<HTMLElement>('[data-dtw-id]')) {
    if (el.parentElement?.closest('[data-dtw-id]') !== containerEl) continue
    const box = el.getBoundingClientRect()
    centers.push((box.top + box.height / 2 - rect.top) / rect.height)
  }
  return centers.sort((a, b) => a - b)
}

/**
 * The deepest container under a viewport point. Temporarily disables the
 * overlay's hit-testing so `elementsFromPoint` sees the rendered tree beneath.
 */
function containerAtPoint(
  overlay: HTMLElement,
  x: number,
  y: number,
  containerIds: Set<ElementId>
): ElementId | null {
  const prev = overlay.style.pointerEvents
  overlay.style.pointerEvents = 'none'
  const stack = document.elementsFromPoint(x, y)
  overlay.style.pointerEvents = prev
  for (const el of stack) {
    const id = (el as HTMLElement).dataset?.dtwId
    if (id && containerIds.has(id)) return id
  }
  return null
}

/** Build the node for a drawn kind, reusing `createPrimitive` + decorations. */
function buildDrawnNode(
  kind: DrawnElementKind,
  id: ElementId,
  placement: GridPlacement,
  breakpoint: BreakpointKey,
  tree: ElementNode
): ElementNode {
  let node = createPrimitive(drawnKindToElementType(kind), id)
  if (kind === 'heading' && node.type === 'text') {
    node = { ...node, tag: headingTagFor(treeHasH1(tree)), content: 'Heading' }
  }
  node = decorateDrawnNode(node, kind)
  return withGridPlacement(node, placement, breakpoint)
}

/** Coerce a non-finite number (NaN / ±Infinity) to `0`. */
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0
}

/**
 * Clamp a normalised rect into the unit box. Non-finite inputs (e.g. a
 * divide-by-zero when a target container measures 0×0) collapse to `0` so a
 * degenerate gesture can never produce a NaN grid placement.
 */
function clampNorm(rect: NormalizedRect): NormalizedRect {
  const x = Math.min(Math.max(finite(rect.x), 0), 1)
  const y = Math.min(Math.max(finite(rect.y), 0), 1)
  return {
    x,
    y,
    width: Math.min(Math.max(finite(rect.width), 0), 1 - x),
    height: Math.min(Math.max(finite(rect.height), 0), 1 - y),
  }
}

// --- component --------------------------------------------------------------

/** The interactive draw overlay. Rendered only while draw mode is active. */
export function DrawSurface(): JSX.Element {
  const activeBreakpoint = useSessionStore((s) => s.activeBreakpoint)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [pending, setPending] = useState<PendingDraw | null>(null)
  const [flash, setFlash] = useState<PxRect | null>(null)

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    const overlay = overlayRef.current
    if (!overlay) return

    const tree = useDocumentStore.getState().document.tree
    if (tree.type !== 'container') return
    const containerIds = collectContainerIds(tree, new Set())

    // Commit to the container under the press (fall back to the root).
    const overlayBox = overlay.getBoundingClientRect()
    const hitId = containerAtPoint(overlay, event.clientX, event.clientY, containerIds) ?? tree.id
    const node = findNode(tree, hitId)
    if (!node || node.type !== 'container') return
    const el = overlay.parentElement?.querySelector<HTMLElement>(`[data-dtw-id="${hitId}"]`)
    const rect = (el ?? overlay).getBoundingClientRect()

    overlay.setPointerCapture(event.pointerId)
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      overlay: overlayBox,
      target: { id: hitId, node, rect, columns: targetColumns(node) },
      current: null,
    }
    setPending(null)
    setFlash(null)
  }, [])

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const drag = dragRef.current
      if (!drag) return
      drag.current = { x: event.clientX, y: event.clientY }

      const { target, overlay } = drag
      const pxRect: PxRect = {
        left: Math.min(drag.startX, event.clientX),
        top: Math.min(drag.startY, event.clientY),
        width: Math.abs(event.clientX - drag.startX),
        height: Math.abs(event.clientY - drag.startY),
      }
      const norm = clampNorm({
        x: (pxRect.left - target.rect.left) / target.rect.width,
        y: (pxRect.top - target.rect.top) / target.rect.height,
        width: pxRect.width / target.rect.width,
        height: pxRect.height / target.rect.height,
      })
      const placement = snapToGrid(
        norm,
        { columns: uniformColumns(target.columns), siblingCenters: [] },
        activeBreakpoint
      )
      const end = placement.columnStart + placement.columnSpan - 1
      setPreview({
        rect: toOverlay(pxRect, overlay),
        targetRect: toOverlay(target.rect, overlay),
        columns: target.columns,
        placement,
        label: `cols ${placement.columnStart}–${end} · ${Math.round(norm.width * 100)}% × ${Math.round(
          norm.height * 100
        )}%`,
      })
    },
    [activeBreakpoint]
  )

  const onPointerUp = useCallback((): void => {
    const drag = dragRef.current
    const overlay = overlayRef.current
    dragRef.current = null
    setPreview(null)
    if (!drag || !overlay || !drag.current) return

    const pxRect: PxRect = {
      left: Math.min(drag.startX, drag.current.x),
      top: Math.min(drag.startY, drag.current.y),
      width: Math.abs(drag.current.x - drag.startX),
      height: Math.abs(drag.current.y - drag.startY),
    }
    if (pxRect.width < MIN_DRAW_PX || pxRect.height < MIN_DRAW_PX) return

    const { target } = drag
    const targetEl = overlay.parentElement?.querySelector<HTMLElement>(
      `[data-dtw-id="${target.id}"]`
    )
    const liveRect = targetEl?.getBoundingClientRect() ?? target.rect

    const norm = clampNorm({
      x: (pxRect.left - liveRect.left) / liveRect.width,
      y: (pxRect.top - liveRect.top) / liveRect.height,
      width: pxRect.width / liveRect.width,
      height: pxRect.height / liveRect.height,
    })
    const siblingCenters = targetEl ? measureSiblingCenters(targetEl, liveRect) : []
    const placement = snapToGrid(
      norm,
      { columns: uniformColumns(target.columns), siblingCenters },
      activeBreakpoint
    )

    const shape: RectangleShape = {
      aspectRatio: pxRect.height > 0 ? pxRect.width / pxRect.height : 1,
      widthFraction: norm.width,
      heightFraction: norm.height,
    }
    const guess = interpretRectangle(shape)

    // Drawing one element is one user action → one history entry. The optional
    // grid-conversion of an empty target and the insert are batched so a single
    // undo reverses the whole gesture (canvas rule: one action, one entry).
    const ops: Operation[] = []

    // Smarter snapping: an empty flex target becomes a grid so the element
    // lands in columns. Skipped for populated containers (non-destructive).
    if (target.node.layout.base.mode !== 'grid' && target.node.children.length === 0) {
      ops.push({
        kind: 'updateNode',
        id: target.id,
        path: ['layout', 'base'],
        value: {
          ...target.node.layout.base,
          mode: 'grid',
          gridTemplateColumns: `repeat(${target.columns}, 1fr)`,
        },
      })
    }

    const id = nanoid(8)
    // The pending grid-conversion only touches the parent's layout, never its
    // heading count, so reading the current tree for the h1 check is correct.
    const tree = useDocumentStore.getState().document.tree
    const node = buildDrawnNode(guess.best, id, placement, activeBreakpoint, tree)
    ops.push({ kind: 'insertElement', parentId: target.id, node, index: placement.insertionIndex })
    if (ops.length === 1) dispatch(ops[0]!)
    else dispatchBatch(ops, 'Draw element')

    setPending({
      id,
      parentId: target.id,
      index: placement.insertionIndex,
      placement,
      breakpoint: activeBreakpoint,
      guess,
      kind: guess.best,
    })

    // Brief insert flash on the new node.
    window.requestAnimationFrame(() => {
      const el = overlay.parentElement?.querySelector<HTMLElement>(`[data-dtw-id="${id}"]`)
      if (!el) return
      setFlash(toOverlay(el.getBoundingClientRect(), overlay.getBoundingClientRect()))
      window.setTimeout(() => setFlash(null), 700)
    })
  }, [activeBreakpoint])

  /** Replace the drawn element with another kind — just more tree operations. */
  const handleReplace = useCallback(
    (next: DrawnElementKind): void => {
      if (!pending) return
      if (next === pending.kind) {
        setPending(null)
        return
      }
      const tree = useDocumentStore.getState().document.tree
      const oldType = drawnKindToElementType(pending.kind)
      const newType = drawnKindToElementType(next)

      // heading ↔ text share an element type: a single retag op suffices.
      if (oldType === 'text' && newType === 'text') {
        const tag = next === 'heading' ? headingTagFor(treeHasH1(tree)) : 'p'
        dispatch({ kind: 'updateNode', id: pending.id, path: ['tag'], value: tag })
        setPending({ ...pending, kind: next })
        return
      }

      // Cross-type: remove and re-insert at the same slot with the same
      // placement. Batched so the swap is a single undo entry, not two. The
      // node being replaced is a freshly-drawn (empty) element, so deleting it
      // can't change the page heading count read here.
      const newId = nanoid(8)
      const node = buildDrawnNode(
        next,
        newId,
        pending.placement,
        pending.breakpoint,
        useDocumentStore.getState().document.tree
      )
      dispatchBatch(
        [
          { kind: 'deleteElement', id: pending.id },
          { kind: 'insertElement', parentId: pending.parentId, node, index: pending.index },
        ],
        'Change element type'
      )
      setPending({ ...pending, id: newId, kind: next })
    },
    [pending]
  )

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      data-testid="draw-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {preview ? <PreviewLayer preview={preview} /> : null}
      {flash ? (
        <div
          className={styles.flash}
          style={{ left: flash.left, top: flash.top, width: flash.width, height: flash.height }}
          aria-hidden
        />
      ) : null}
      {pending ? (
        <DrawTypePicker
          targetId={pending.id}
          guess={pending.guess}
          current={pending.kind}
          onPick={handleReplace}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}

/** Build a uniform per-breakpoint column profile from a single count. */
function uniformColumns(n: number): {
  base: number
  tablet: number
  mobile: number
  small: number
} {
  return { base: n, tablet: n, mobile: n, small: n }
}

/** Convert a client rect to overlay-relative pixels. */
function toOverlay(rect: PxRect | DOMRect, overlay: DOMRect): PxRect {
  return {
    left: rect.left - overlay.left,
    top: rect.top - overlay.top,
    width: rect.width,
    height: rect.height,
  }
}

/** The live preview: column highlight, snap guides, drawn rect, and label. */
function PreviewLayer({ preview }: { preview: Preview }): JSX.Element {
  const { rect, targetRect, columns, placement, label } = preview
  const colWidth = targetRect.width / columns
  const guideLeft = targetRect.left + (placement.columnStart - 1) * colWidth
  const guideRight = targetRect.left + (placement.columnStart - 1 + placement.columnSpan) * colWidth

  const labelStyle: CSSProperties = {
    left: rect.left,
    top: Math.max(0, rect.top - 22),
  }

  return (
    <>
      <div
        className={styles.columns}
        style={{
          left: targetRect.left,
          top: targetRect.top,
          width: targetRect.width,
          height: targetRect.height,
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
        }}
        aria-hidden
      >
        {Array.from({ length: columns }, (_, i) => {
          const col = i + 1
          const active =
            col >= placement.columnStart && col < placement.columnStart + placement.columnSpan
          return <span key={i} className={styles.column} data-active={active} />
        })}
      </div>
      <div
        className={styles.guide}
        style={{ left: guideLeft, top: targetRect.top, height: targetRect.height }}
        aria-hidden
      />
      <div
        className={styles.guide}
        style={{ left: guideRight, top: targetRect.top, height: targetRect.height }}
        aria-hidden
      />
      <div
        className={styles.preview}
        style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        aria-hidden
      />
      <div className={styles.dimLabel} style={labelStyle} aria-hidden>
        {label}
      </div>
    </>
  )
}
