import type { SemanticElement } from '../engine'
import type { ElementProps } from '../store/elementStore'

const INDENT = '  '

/** Tags that wrap child elements and emit open/close pairs. */
const CONTAINER_TAGS = new Set<string>([
  'header',
  'nav',
  'main',
  'footer',
  'section',
  'div',
  'article',
  'aside',
])

/** Escapes characters unsafe in HTML text content and attribute values. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Safely reads a string value from the element props bag. */
function strProp(props: ElementProps, key: keyof ElementProps): string | undefined {
  const v = props[key]
  return typeof v === 'string' ? v : undefined
}

/** Returns the scoped CSS class name for an element. */
function cls(id: string): string {
  return `dtw-el-${id}`
}

function renderElement(el: SemanticElement, depth: number): string {
  const pad = INDENT.repeat(depth)
  const { semanticTag: tag } = el
  const c = cls(el.id)

  if (tag === 'img') {
    const src = escapeHtml(strProp(el.props, 'src') ?? '')
    const alt = escapeHtml(strProp(el.props, 'alt') ?? '')
    return `${pad}<img class="${c}" src="${src}" alt="${alt}" />`
  }

  if (tag === 'button') {
    const text = escapeHtml(strProp(el.props, 'text') ?? '')
    return `${pad}<button class="${c}" type="button">${text}</button>`
  }

  if (CONTAINER_TAGS.has(tag)) {
    const children = el.children ?? []
    if (children.length === 0) {
      return `${pad}<${tag} class="${c}"></${tag}>`
    }
    const inner = children.map((child) => renderElement(child, depth + 1)).join('\n')
    return `${pad}<${tag} class="${c}">\n${inner}\n${pad}</${tag}>`
  }

  // Text elements: h1, h2, h3, p
  const text = escapeHtml(strProp(el.props, 'text') ?? '')
  return `${pad}<${tag} class="${c}">${text}</${tag}>`
}

/**
 * Emits body HTML from a semantic element tree (depth-first traversal).
 * Output is intended to be embedded inside the root canvas container.
 * @param elements - Root-level semantic elements, ordered top-to-bottom
 */
export function emitHtml(elements: SemanticElement[]): string {
  return elements.map((el) => renderElement(el, 0)).join('\n')
}
