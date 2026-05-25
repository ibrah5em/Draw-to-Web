/**
 * Pure helpers for the layers tree (L-LYR-01).
 *
 * Kept free of React so the label logic can be unit-tested in isolation.
 */

import type { ElementNode, ElementType } from '@document/types'

/** Human label per element type, shown when a node has no author name. */
export const LAYER_TYPE_LABEL: Record<ElementType, string> = {
  container: 'Container',
  text: 'Text',
  image: 'Image',
  button: 'Button',
  link: 'Link',
  icon: 'Icon',
  list: 'List',
  divider: 'Divider',
}

/**
 * Display label for a layer row: the author-given `name` when present,
 * otherwise the element type's default label.
 *
 * @param node - The element to label.
 */
export function layerLabel(node: ElementNode): string {
  const name = node.name?.trim()
  return name ? name : LAYER_TYPE_LABEL[node.type]
}
