/**
 * Canvas root (L-CAN-02).
 *
 * Subscribes to the document tree and renders it through the recursive
 * {@link CanvasNode}. The viewport is a scrollable, centered surface; the
 * tree itself is the page being authored. Live token resolution (L-CAN-03)
 * wraps this in a `StyleResolverProvider`; for now the default raw resolver
 * applies.
 */

import type { JSX } from 'react'

import { useTree } from '@store/documentStore'

import { CanvasNode } from './CanvasNode'
import styles from './Canvas.module.css'

/** The editor canvas surface. */
export function Canvas(): JSX.Element {
  const tree = useTree()
  return (
    <div className={styles.viewport}>
      <div className={styles.page}>
        <CanvasNode node={tree} />
      </div>
    </div>
  )
}
