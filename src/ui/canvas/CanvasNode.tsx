/**
 * Recursive canvas renderer (L-CAN-02).
 *
 * Walks an `ElementNode` tree and renders it as nested real DOM elements
 * styled with CSS Flexbox / Grid — never Konva, never `position: absolute`
 * (invariant 3, `.claude/rules/canvas.md`). The canvas is a *rendering* of
 * the document tree; it owns no state and dispatches no mutations here.
 * Selection (L-CAN-05), live token resolution (L-CAN-03) and inline editing
 * (L-CAN-07) layer on in their own tasks.
 */

import type { JSX } from 'react'

import type { ElementNode } from '@document/types'

import { nodeStyle } from './buildStyle'
import { useStyleResolver } from './resolverContext'

/** Intrinsic tag used for a container, derived from its semantic role. */
type ContainerTag = keyof JSX.IntrinsicElements

/**
 * Render a single document element and (for containers) its descendants.
 *
 * @param node - The element to render.
 */
export function CanvasNode({ node }: { node: ElementNode }): JSX.Element {
  const resolve = useStyleResolver()
  const style = nodeStyle(node, resolve)

  switch (node.type) {
    case 'container': {
      const Tag = (node.semanticRole ?? 'div') as ContainerTag
      return (
        <Tag style={style} data-dtw-id={node.id}>
          {node.children.map((child) => (
            <CanvasNode key={child.id} node={child} />
          ))}
        </Tag>
      )
    }

    case 'text': {
      const Tag = node.tag
      return (
        <Tag style={style} data-dtw-id={node.id}>
          {node.content}
        </Tag>
      )
    }

    case 'image': {
      const src = node.externalUrl ?? (node.assetId ? `asset:${node.assetId}` : undefined)
      return (
        <img
          style={style}
          data-dtw-id={node.id}
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
          data-dtw-id={node.id}
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
          data-dtw-id={node.id}
          aria-label={node.ariaLabel}
        >
          {node.content}
        </a>
      )

    case 'icon':
      return (
        <span
          style={style}
          data-dtw-id={node.id}
          aria-hidden={node.decorative ? true : undefined}
          aria-label={node.decorative ? undefined : node.ariaLabel}
          {...(node.inlineSvg ? { dangerouslySetInnerHTML: { __html: node.inlineSvg } } : {})}
        />
      )

    case 'list': {
      const Tag = node.ordered ? 'ol' : 'ul'
      return (
        <Tag style={{ ...style, listStyleType: node.marker }} data-dtw-id={node.id}>
          {node.items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </Tag>
      )
    }

    case 'divider':
      return node.orientation === 'horizontal' ? (
        <hr style={style} data-dtw-id={node.id} />
      ) : (
        <div style={style} data-dtw-id={node.id} role="separator" aria-orientation="vertical" />
      )
  }
}
