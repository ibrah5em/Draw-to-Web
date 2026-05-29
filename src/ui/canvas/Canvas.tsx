/**
 * Canvas root (L-CAN-02 / L-CAN-03 / L-CAN-04 / L-CAN-06).
 *
 * Subscribes to the document tree and renders it through the recursive
 * {@link CanvasNode}. Three enrichments wrap the render:
 *
 *   - L-CAN-03: a `resolveToken`-backed {@link StyleResolver} provided via
 *     context, rebuilt whenever the token registry or preview theme changes,
 *     so token edits repaint every bound element.
 *   - L-CAN-04: {@link inferSemantics} annotates the tree with semantic-role
 *     hints so containers render with their landmark tag.
 *   - L-CAN-06: pointer-down on empty viewport space starts a marquee that
 *     selects every element whose bounding box intersects the rectangle.
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { isTokenRef, resolveToken } from '@document/tokens'
import { useTokens, useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { BREAKPOINT_WIDTH_PX } from '../topbar/BreakpointSwitcher'
import type { StyleResolver } from './buildStyle'
import { CanvasNode } from './CanvasNode'
import styles from './Canvas.module.css'
import { inferSemantics } from './inferSemantics'
import { MARQUEE_ACTIVATION_PX, rectFromPoints, rectsIntersect, type Rect } from './marqueeSelect'
import { StyleResolverProvider } from './resolverContext'

interface MarqueeState {
  readonly startX: number
  readonly startY: number
  readonly rect: Rect | null
  readonly additive: boolean
  readonly baseSelection: readonly string[]
}

/** The editor canvas surface. */
export function Canvas(): JSX.Element {
  const tree = useTree()
  const tokens = useTokens()
  const theme = useSessionStore((s) => s.theme)
  const activeBreakpoint = useSessionStore((s) => s.activeBreakpoint)
  const setSelectedIds = useSessionStore((s) => s.setSelectedIds)
  const clearSelection = useSessionStore((s) => s.clearSelection)

  const resolve = useMemo<StyleResolver>(
    () => (value) => {
      if (isTokenRef(value)) return resolveToken(tokens, value, theme) ?? undefined
      return value
    },
    [tokens, theme]
  )

  const annotated = useMemo(() => inferSemantics(tree), [tree])

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null)

  const collectIntersecting = useCallback((rect: Rect): string[] => {
    const viewport = viewportRef.current
    if (!viewport) return []
    const viewportBox = viewport.getBoundingClientRect()
    const absolute: Rect = {
      x: rect.x + viewportBox.left,
      y: rect.y + viewportBox.top,
      width: rect.width,
      height: rect.height,
    }
    const matches: string[] = []
    const elements = viewport.querySelectorAll<HTMLElement>('[data-dtw-id]')
    for (const el of elements) {
      const id = el.dataset.dtwId
      if (!id) continue
      const box = el.getBoundingClientRect()
      const elRect: Rect = { x: box.left, y: box.top, width: box.width, height: box.height }
      if (rectsIntersect(absolute, elRect)) matches.push(id)
    }
    return matches
  }, [])

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    // Only start a marquee from a primary-button press on the empty viewport.
    // Clicks that originate on a rendered node bubble up but we ignore them
    // here so dnd-kit / per-node click handlers stay in charge.
    if (event.button !== 0) return
    if (event.target !== event.currentTarget) return
    const viewport = viewportRef.current
    if (!viewport) return
    const box = viewport.getBoundingClientRect()
    marqueeRef.current = {
      startX: event.clientX - box.left,
      startY: event.clientY - box.top,
      rect: null,
      additive: event.shiftKey || event.ctrlKey || event.metaKey,
      baseSelection: useSessionStore.getState().selectedIds,
    }
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = marqueeRef.current
    if (!drag) return
    const viewport = viewportRef.current
    if (!viewport) return
    const box = viewport.getBoundingClientRect()
    const x = event.clientX - box.left
    const y = event.clientY - box.top
    if (drag.rect === null) {
      const dx = Math.abs(x - drag.startX)
      const dy = Math.abs(y - drag.startY)
      if (Math.max(dx, dy) < MARQUEE_ACTIVATION_PX) return
    }
    const rect = rectFromPoints(drag.startX, drag.startY, x, y)
    marqueeRef.current = { ...drag, rect }
    setMarqueeRect(rect)
  }, [])

  const finishMarquee = useCallback((): void => {
    const drag = marqueeRef.current
    marqueeRef.current = null
    setMarqueeRect(null)
    if (!drag || drag.rect === null) {
      if (!drag?.additive) clearSelection()
      return
    }
    const hits = collectIntersecting(drag.rect)
    if (drag.additive) {
      const next = new Set<string>(drag.baseSelection)
      for (const id of hits) next.add(id)
      setSelectedIds(Array.from(next))
    } else {
      setSelectedIds(hits)
    }
  }, [clearSelection, collectIntersecting, setSelectedIds])

  const pageStyle: CSSProperties = useMemo(
    () => ({ maxWidth: `${BREAKPOINT_WIDTH_PX[activeBreakpoint]}px` }),
    [activeBreakpoint]
  )

  const marqueeStyle: CSSProperties | undefined = marqueeRect
    ? {
        left: marqueeRect.x,
        top: marqueeRect.y,
        width: marqueeRect.width,
        height: marqueeRect.height,
      }
    : undefined

  return (
    <div
      ref={viewportRef}
      className={styles.viewport}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishMarquee}
      onPointerCancel={finishMarquee}
    >
      <div
        className={styles.page}
        data-theme={theme}
        data-breakpoint={activeBreakpoint}
        style={pageStyle}
      >
        <StyleResolverProvider value={resolve}>
          <CanvasNode node={annotated} />
        </StyleResolverProvider>
      </div>
      {marqueeStyle && <div className={styles.marquee} style={marqueeStyle} aria-hidden />}
    </div>
  )
}
