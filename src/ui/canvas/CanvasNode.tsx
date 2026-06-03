/**
 * Recursive canvas renderer (L-CAN-02, selection L-CAN-05).
 *
 * Walks an `ElementNode` tree and renders it as nested real DOM elements
 * styled with CSS Flexbox / Grid — never Konva, never `position: absolute`
 * (invariant 3, `.claude/rules/canvas.md`). The canvas is a *rendering* of
 * the document tree; it owns no state. Clicking a node records its id as the
 * selection in `sessionStore`; the deepest node wins via `stopPropagation`.
 *
 * Drag wiring: containers register a dnd-kit drop target for Insert cards
 * (L-CAN-12) and host a `SortableContext` over their children so siblings
 * can be reordered by drag (L-CAN-13). Every node calls `useSortable` so
 * it participates in its parent's sortable list; clicks still work because
 * the parent `DndContext` activates drag only after a small pointer delta.
 */

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ErrorBoundary } from 'react-error-boundary'
import {
  createElement,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type JSX,
  type Ref,
} from 'react'

import type { ElementNode, TextNode } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { useViewPrefs } from '../state/viewPrefs'
import { containerDropId } from '../sidebar/insertDrop'
import { assetPreviewSrc } from './assetSrc'
import { nodeStyle } from './buildStyle'
import { NodeErrorFallback } from './NodeErrorFallback'
import { useStyleResolver } from './resolverContext'

/** Intrinsic tag used for a container, derived from its semantic role. */
type ContainerTag = keyof JSX.IntrinsicElements

/** Outline applied to the selected node; inset so it never shifts layout. */
const SELECTED_OUTLINE: CSSProperties = {
  outline: '2px solid var(--accent)',
  outlineOffset: '-2px',
}

/** Outline applied to the container the cursor is over during an Insert drag. */
const DROP_OVER_OUTLINE: CSSProperties = {
  outline: '2px dashed var(--accent)',
  outlineOffset: '-2px',
  background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
}

interface SortableHandle {
  readonly ref: Ref<HTMLElement>
  readonly style: CSSProperties
  readonly listeners: Record<string, unknown>
  readonly attributes: Record<string, unknown>
}

/**
 * Hook wrapping `useSortable` so every CanvasNode participates in its
 * parent's sortable list. Returns ref + listeners + transform style ready
 * to spread onto the rendered DOM node.
 */
function useNodeSortable(id: string): SortableHandle {
  const sortable = useSortable({ id, data: { source: 'canvas' } })
  return {
    ref: sortable.setNodeRef as unknown as Ref<HTMLElement>,
    style: {
      transform: CSS.Transform.toString(sortable.transform),
      transition: sortable.transition,
      opacity: sortable.isDragging ? 0.4 : undefined,
    },
    listeners: (sortable.listeners ?? {}) as Record<string, unknown>,
    attributes: sortable.attributes as unknown as Record<string, unknown>,
  }
}

/**
 * Render a single document element and (for containers) its descendants.
 *
 * Wrapped in {@link memo} (Y-PRF-01): the only prop is `node`, and every
 * document mutation flows through immer, so untouched subtrees keep their
 * `ElementNode` reference. When a parent re-renders (e.g. a sibling changed),
 * memo's default shallow prop compare sees the unchanged `node` reference and
 * skips this subtree — the lever that holds the 100-element drag at 60 fps.
 * Selection / breakpoint / state changes still re-render through the
 * `useSessionStore` subscriptions below, which memo does not block.
 *
 * @param node - The element to render.
 */
export const CanvasNode = memo(function CanvasNode({ node }: { node: ElementNode }): JSX.Element {
  const resolve = useStyleResolver()
  const selected = useSessionStore((s) => s.selectedIds.includes(node.id))
  const setSelectedIds = useSessionStore((s) => s.setSelectedIds)
  const toggleSelected = useSessionStore((s) => s.toggleSelected)
  const activeBreakpoint = useSessionStore((s) => s.activeBreakpoint)
  const activeState = useSessionStore((s) => s.activeState)
  const hoverPreview = useViewPrefs((s) => s.hoverPreview)
  const isHidden = useViewPrefs((s) => s.hiddenIds.has(node.id))
  const isLocked = useViewPrefs((s) => s.lockedIds.has(node.id))
  // Uploaded images live in `document.assets`; subscribe to this node's entry
  // so the canvas can preview it through the `dtw-asset://` scheme.
  const assetEntry = useDocumentStore((s) =>
    node.type === 'image' && node.assetId ? s.document.assets[node.assetId] : undefined
  )
  const rawSortable = useNodeSortable(node.id)
  // Locked elements keep their ref (so layout stays measured) but shed their
  // drag listeners / attributes so they can't be dragged on the canvas.
  const sortable: SortableHandle = isLocked
    ? { ...rawSortable, listeners: {}, attributes: {} }
    : rawSortable

  // Hover-preview (L-TOP-03) forces every node into its `:hover` render state
  // without mutating the document; otherwise we honour the session's active
  // pseudo-state (L-PRP-05).
  const effectiveState = hoverPreview ? 'hover' : activeState
  const base = nodeStyle(node, resolve, activeBreakpoint, effectiveState)
  // Hidden (Layers eye toggle) removes the element from the canvas without
  // touching the document; the subtree disappears with its container.
  const visibilityStyle: CSSProperties = isHidden ? { ...base, display: 'none' } : base
  const styleWithSelection = selected
    ? { ...visibilityStyle, ...SELECTED_OUTLINE }
    : visibilityStyle
  const style: CSSProperties = { ...styleWithSelection, ...sortable.style }

  const onClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    // Locked elements ignore canvas selection — unlock from the Layers tree.
    if (isLocked) return
    // Shift / Ctrl / Cmd toggle the element in/out of the current selection
    // (L-CAN-06). Plain click replaces it. The store's `toggleSelected`
    // preserves selection order which the Layers tree relies on.
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      toggleSelected(node.id)
      return
    }
    setSelectedIds([node.id])
  }
  const common = { 'data-dtw-id': node.id, onClick }

  switch (node.type) {
    case 'container': {
      const Tag = (node.semanticRole ?? 'div') as ContainerTag
      return (
        <ContainerNodeView
          Tag={Tag}
          node={node}
          baseStyle={styleWithSelection}
          sortable={sortable}
          commonProps={common}
        />
      )
    }

    case 'text': {
      return (
        <TextNodeView
          node={node}
          style={style}
          sortable={sortable}
          commonProps={common}
          locked={isLocked}
        />
      )
    }

    case 'image': {
      const src = node.externalUrl ?? assetPreviewSrc(assetEntry)
      return (
        <img
          ref={sortable.ref as Ref<HTMLImageElement>}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLImageElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLImageElement>)}
          {...common}
          src={src}
          alt={node.alt}
          loading={node.loading}
          decoding={node.decoding}
        />
      )
    }

    case 'button':
      return (
        <button
          ref={sortable.ref as Ref<HTMLButtonElement>}
          type={node.buttonType ?? 'button'}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLButtonElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLButtonElement>)}
          {...common}
          aria-label={node.ariaLabel}
        >
          {node.content}
        </button>
      )

    case 'link':
      return (
        <a
          ref={sortable.ref as Ref<HTMLAnchorElement>}
          href={node.href}
          target={node.target}
          rel={node.rel}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLAnchorElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLAnchorElement>)}
          {...common}
          aria-label={node.ariaLabel}
        >
          {node.content}
        </a>
      )

    case 'icon':
      return (
        <span
          ref={sortable.ref as Ref<HTMLSpanElement>}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLSpanElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLSpanElement>)}
          {...common}
          aria-hidden={node.decorative ? true : undefined}
          aria-label={node.decorative ? undefined : node.ariaLabel}
          {...(node.inlineSvg ? { dangerouslySetInnerHTML: { __html: node.inlineSvg } } : {})}
        />
      )

    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul'
      return createElement(
        Tag,
        {
          ref: sortable.ref,
          style: { ...style, listStyleType: node.marker },
          ...sortable.attributes,
          ...sortable.listeners,
          ...common,
        },
        node.items.map((item, index) => <li key={index}>{item}</li>)
      )
    }

    case 'divider':
      return node.orientation === 'horizontal' ? (
        <hr
          ref={sortable.ref as Ref<HTMLHRElement>}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLHRElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLHRElement>)}
          {...common}
        />
      ) : (
        <div
          ref={sortable.ref as Ref<HTMLDivElement>}
          style={style}
          {...(sortable.attributes as HTMLAttributes<HTMLDivElement>)}
          {...(sortable.listeners as HTMLAttributes<HTMLDivElement>)}
          {...common}
          role="separator"
          aria-orientation="vertical"
        />
      )
  }
})

/**
 * Per-element error boundary wrapper (L-CAN-09).
 *
 * Wraps a single {@link CanvasNode} so that if its render throws, only this
 * node is replaced by {@link NodeErrorFallback} — siblings and the rest of
 * the canvas keep rendering. `resetKeys` is the node reference: because every
 * edit flows through immer, a fix to this node produces a new reference and
 * auto-resets the boundary, so a corrected element re-renders without a
 * manual retry.
 *
 * Also wrapped in {@link memo} (Y-PRF-01) so it is the memoised unit the
 * parent container maps over: an unchanged child `node` reference short-
 * circuits both the boundary and its `CanvasNode` subtree in one shallow
 * compare. Used at the canvas root (see `Canvas.tsx`) and for every child
 * inside a container, so the isolation holds at any depth.
 */
export const CanvasNodeBoundary = memo(function CanvasNodeBoundary({
  node,
}: {
  node: ElementNode
}): JSX.Element {
  return (
    <ErrorBoundary FallbackComponent={NodeErrorFallback} resetKeys={[node]}>
      <CanvasNode node={node} />
    </ErrorBoundary>
  )
})

interface ContainerNodeViewProps {
  readonly Tag: ContainerTag
  readonly node: Extract<ElementNode, { type: 'container' }>
  readonly baseStyle: CSSProperties
  readonly sortable: SortableHandle
  readonly commonProps: { 'data-dtw-id': string; onClick: (event: MouseEvent) => void }
}

/**
 * Container renderer split out so it can participate in dnd-kit drops
 * (L-CAN-12). Highlights itself while the cursor hovers during an Insert
 * drag so authors see where the drop will land. Hosts a SortableContext
 * over its children so sibling reorder (L-CAN-13) works inside the canvas.
 *
 * Also wires its own `useSortable` handle so the container is draggable like
 * any other node (L-CAN-13): the sortable ref is composed with the droppable
 * ref onto the same element, the transform style is applied, and the drag
 * listeners are spread. Without this the container was an unmeasured sortable
 * item — un-draggable, and skewing neighbour shift math.
 */
function ContainerNodeView({
  Tag,
  node,
  baseStyle,
  sortable,
  commonProps,
}: ContainerNodeViewProps): JSX.Element {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: containerDropId(node.id),
    data: { accepts: 'insert', containerId: node.id },
  })
  const setRef = useCallback(
    (el: HTMLElement | null): void => {
      setDropRef(el)
      if (typeof sortable.ref === 'function') sortable.ref(el)
    },
    // `sortable` is a fresh object each render; `sortable.ref` (dnd-kit's stable
    // setNodeRef) is the identity we actually depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setDropRef, sortable.ref]
  )
  const merged: CSSProperties = { ...baseStyle, ...sortable.style }
  const style: CSSProperties = isOver ? { ...merged, ...DROP_OVER_OUTLINE } : merged
  const childIds = node.children.map((child) => child.id)
  return createElement(
    Tag,
    {
      ref: setRef,
      style,
      ...sortable.attributes,
      ...sortable.listeners,
      ...commonProps,
      'data-drop-over': isOver || undefined,
    },
    <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
      {node.children.map((child) => (
        <CanvasNodeBoundary key={child.id} node={child} />
      ))}
    </SortableContext>
  )
}

interface TextNodeViewProps {
  readonly node: TextNode
  readonly style: CSSProperties
  readonly sortable: SortableHandle
  readonly commonProps: { 'data-dtw-id': string; onClick: (event: MouseEvent) => void }
  readonly locked: boolean
}

/**
 * Text renderer with inline edit-on-double-click (L-CAN-07). While editing,
 * the element is `contentEditable` and the sortable drag listeners are
 * detached so typing / native text selection isn't hijacked by dnd-kit. Blur
 * dispatches `updateNode` with the raw `textContent` — using the DOM text
 * node round-trips whitespace and special characters verbatim. Escape
 * cancels without dispatch.
 */
function TextNodeView({
  node,
  style,
  sortable,
  commonProps,
  locked,
}: TextNodeViewProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const elementRef = useRef<HTMLElement | null>(null)

  // Place the cursor at the end of the text and focus the element when the
  // edit mode opens. Done in an effect so the contentEditable attribute is
  // already on the DOM by the time we touch the selection.
  useEffect(() => {
    if (!editing) return
    const el = elementRef.current
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }, [editing])

  // Stable across renders so React doesn't detach/reattach the node every
  // render; identity changes only when `editing` toggles, which is exactly
  // when we want to attach / detach the dnd-kit sortable ref.
  const setRef = useCallback(
    (el: HTMLElement | null): void => {
      elementRef.current = el
      // Defer to dnd-kit only while not editing — keeps drag wiring off the
      // node so the activator pointerdown doesn't steal text selection.
      if (!editing && typeof sortable.ref === 'function') sortable.ref(el)
    },
    // `sortable.ref` is dnd-kit's stable setNodeRef; the surrounding `sortable`
    // object is recreated each render and intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, sortable.ref]
  )

  const onDoubleClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    // Locked elements can't be edited inline — unlock from the Layers tree.
    if (locked) return
    setEditing(true)
  }

  const onBlur = (event: FocusEvent<HTMLElement>): void => {
    setEditing(false)
    const next = event.currentTarget.textContent ?? ''
    if (next !== node.content) {
      dispatch({ kind: 'updateNode', id: node.id, path: ['content'], value: next })
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (elementRef.current) elementRef.current.textContent = node.content
      setEditing(false)
      elementRef.current?.blur()
    }
  }

  const dragProps = editing ? {} : { ...sortable.attributes, ...sortable.listeners }
  const clickProps = editing ? {} : commonProps

  return createElement(
    node.tag,
    {
      ref: setRef,
      style,
      ...dragProps,
      ...clickProps,
      'data-dtw-id': node.id,
      onDoubleClick,
      ...(editing
        ? {
            contentEditable: true,
            suppressContentEditableWarning: true,
            spellCheck: true,
            onBlur,
            onKeyDown,
            'data-editing': true,
          }
        : {}),
    },
    node.content
  )
}
