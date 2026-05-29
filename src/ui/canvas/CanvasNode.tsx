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
import {
  createElement,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type JSX,
  type Ref,
} from 'react'

import type { ElementNode } from '@document/types'
import { useSessionStore } from '@store/sessionStore'

import { containerDropId } from '../sidebar/insertDrop'
import { nodeStyle } from './buildStyle'
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
 * @param node - The element to render.
 */
export function CanvasNode({ node }: { node: ElementNode }): JSX.Element {
  const resolve = useStyleResolver()
  const selected = useSessionStore((s) => s.selectedIds.includes(node.id))
  const setSelectedIds = useSessionStore((s) => s.setSelectedIds)
  const sortable = useNodeSortable(node.id)

  const base = nodeStyle(node, resolve)
  const styleWithSelection = selected ? { ...base, ...SELECTED_OUTLINE } : base
  const style: CSSProperties = { ...styleWithSelection, ...sortable.style }

  const onClick = (event: MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
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
          commonProps={common}
        />
      )
    }

    case 'text': {
      const Tag = node.tag
      return createElement(
        Tag,
        {
          ref: sortable.ref,
          style,
          ...sortable.attributes,
          ...sortable.listeners,
          ...common,
        },
        node.content
      )
    }

    case 'image': {
      const src = node.externalUrl ?? (node.assetId ? `asset:${node.assetId}` : undefined)
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
}

interface ContainerNodeViewProps {
  readonly Tag: ContainerTag
  readonly node: Extract<ElementNode, { type: 'container' }>
  readonly baseStyle: CSSProperties
  readonly commonProps: { 'data-dtw-id': string; onClick: (event: MouseEvent) => void }
}

/**
 * Container renderer split out so it can participate in dnd-kit drops
 * (L-CAN-12). Highlights itself while the cursor hovers during an Insert
 * drag so authors see where the drop will land. Hosts a SortableContext
 * over its children so sibling reorder (L-CAN-13) works inside the canvas.
 */
function ContainerNodeView({
  Tag,
  node,
  baseStyle,
  commonProps,
}: ContainerNodeViewProps): JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: containerDropId(node.id),
    data: { accepts: 'insert', containerId: node.id },
  })
  const style: CSSProperties = isOver ? { ...baseStyle, ...DROP_OVER_OUTLINE } : baseStyle
  const childIds = node.children.map((child) => child.id)
  return createElement(
    Tag,
    {
      ref: setNodeRef,
      style,
      ...commonProps,
      'data-drop-over': isOver || undefined,
    },
    <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
      {node.children.map((child) => (
        <CanvasNode key={child.id} node={child} />
      ))}
    </SortableContext>
  )
}
