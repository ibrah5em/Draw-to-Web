/**
 * Canvas root (L-CAN-02 / L-CAN-03 / L-CAN-04).
 *
 * Subscribes to the document tree and renders it through the recursive
 * {@link CanvasNode}. Two enrichments wrap the render:
 *
 *   - L-CAN-03: a `resolveToken`-backed {@link StyleResolver} provided via
 *     context, rebuilt whenever the token registry or preview theme changes,
 *     so token edits repaint every bound element.
 *   - L-CAN-04: {@link inferSemantics} annotates the tree with semantic-role
 *     hints so containers render with their landmark tag.
 */

import { useMemo, type JSX } from 'react'

import { isTokenRef, resolveToken } from '@document/tokens'
import { useTokens, useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import type { StyleResolver } from './buildStyle'
import { CanvasNode } from './CanvasNode'
import styles from './Canvas.module.css'
import { inferSemantics } from './inferSemantics'
import { StyleResolverProvider } from './resolverContext'

/** The editor canvas surface. */
export function Canvas(): JSX.Element {
  const tree = useTree()
  const tokens = useTokens()
  const theme = useSessionStore((s) => s.theme)

  const resolve = useMemo<StyleResolver>(
    () => (value) => {
      if (isTokenRef(value)) return resolveToken(tokens, value, theme) ?? undefined
      return value
    },
    [tokens, theme]
  )

  const annotated = useMemo(() => inferSemantics(tree), [tree])

  return (
    <div className={styles.viewport}>
      <div className={styles.page}>
        <StyleResolverProvider value={resolve}>
          <CanvasNode node={annotated} />
        </StyleResolverProvider>
      </div>
    </div>
  )
}
