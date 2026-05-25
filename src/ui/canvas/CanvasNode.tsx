/**
 * Recursive canvas renderer (L-CAN-02, selection L-CAN-05).
 *
 * Walks an `ElementNode` tree and renders it as nested real DOM elements
 * styled with CSS Flexbox / Grid — never Konva, never `position: absolute`
 * (invariant 3, `.claude/rules/canvas.md`). The canvas is a *rendering* of
 * the document tree; it owns no state. Clicking a node records its id as the
 * selection in `sessionStore`; the deepest node wins via `stopPropagation`.
 */

import type { CSSProperties, MouseEvent, JSX } from 'react'

import type { ElementNode } from '@document/types'
import { useSessionStore } from '@store/sessionStore'

import { nodeStyle } from './buildStyle'
import { useStyleResolver } from './resolverContext'

/** Intrinsic tag used for a container, derived from its semantic role. */
type ContainerTag = keyof JSX.IntrinsicElements

/** Outline applied to the selected node; inset so it never shifts layout. */
const SELECTED_OUTLINE: CSSProperties = {
  outline: '2px solid var(--accent)',
  outlineOffset: '-2px',
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

  const base = nodeStyle(node, resolve)
  const style = selected ? { ...base, ...SELECTED_OUTLINE } : base

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
        <Tag style={style} {...common}>
          {node.children.map((child) => (
            <CanvasNode key={child.id} node={child} />
          ))}
        </Tag>
      )
    }

    case 'text': {
      const Tag = node.tag
      return (
        <Tag style={style} {...common}>
          {node.content}
        </Tag>
      )
    }

    case 'image': {
      const src = node.externalUrl ?? (node.assetId ? `asset:${node.assetId}` : undefined)
      return (
        <img
          style={style}
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
          type={node.buttonType ?? 'button'}
          style={style}
          {...common}
          aria-label={node.ariaLabel}
        >
          {node.content}
        </button>
      )

    case 'link':
      return (
        <a
          href={node.href}
          target={node.target}
          rel={node.rel}
          style={style}
          {...common}
          aria-label={node.ariaLabel}
        >
          {node.content}
        </a>
      )

    case 'icon':
      return (
        <span
          style={style}
          {...common}
          aria-hidden={node.decorative ? true : undefined}
          aria-label={node.decorative ? undefined : node.ariaLabel}
          {...(node.inlineSvg ? { dangerouslySetInnerHTML: { __html: node.inlineSvg } } : {})}
        />
      )

    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul'
      return (
        <Tag style={{ ...style, listStyleType: node.marker }} {...common}>
          {node.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </Tag>
      )
    }

    case 'divider':
      return node.orientation === 'horizontal' ? (
        <hr style={style} {...common} />
      ) : (
        <div style={style} {...common} role="separator" aria-orientation="vertical" />
      )
  }
}
