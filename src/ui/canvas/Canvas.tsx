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
import { useDocumentSettings, useTokens, useTree } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

import { useViewPrefs } from '../state/viewPrefs'
import { BREAKPOINT_WIDTH_PX } from '../topbar/BreakpointSwitcher'
import type { StyleResolver } from './buildStyle'
import { CanvasContextMenu } from './CanvasContextMenu'
import { CanvasNodeBoundary } from './CanvasNode'
import styles from './Canvas.module.css'
import { inferSemantics } from './inferSemantics'
import {
  MARQUEE_ACTIVATION_PX,
  rectFromPoints,
  rectsIntersect,
  topmostMatches,
  type Rect,
} from './marqueeSelect'
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
  const settings = useDocumentSettings()
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
    // Hidden elements aren't painted and locked ones ignore interaction, so a
    // marquee skips both (a hidden element selects nothing; unlock from Layers).
    const { hiddenIds, lockedIds } = useViewPrefs.getState()
    const matched: HTMLElement[] = []
    const elements = viewport.querySelectorAll<HTMLElement>('[data-dtw-id]')
    for (const el of elements) {
      const id = el.dataset.dtwId
      if (!id || hiddenIds.has(id) || lockedIds.has(id)) continue
      const box = el.getBoundingClientRect()
      const elRect: Rect = { x: box.left, y: box.top, width: box.width, height: box.height }
      if (rectsIntersect(absolute, elRect)) matched.push(el)
    }
    // Keep only the topmost element per stack so ancestors / the root aren't
    // swept into the selection alongside the leaves they contain.
    return topmostMatches(matched)
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
    // No armed marquee means the pointer went down on a rendered node, not on
    // empty canvas — leave the selection to that node's click handler. Clearing
    // here would wipe a Shift/Ctrl-click accumulation before it lands.
    if (!drag) return
    if (drag.rect === null) {
      // Pressed-and-released on empty canvas without dragging: a click on the
      // void deselects, unless it was an additive (Shift/Ctrl) press.
      if (!drag.additive) clearSelection()
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
      <CanvasContextMenu>
        <div
          className={styles.page}
          data-theme={theme}
          data-breakpoint={activeBreakpoint}
          style={pageStyle}
        >
          <StyleResolverProvider value={resolve}>
            <CanvasNodeBoundary node={annotated} />
          </StyleResolverProvider>
          {settings.gridVisible ? (
            <div className={styles.gridOverlay} aria-hidden data-testid="grid-overlay">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className={styles.gridColumn} />
              ))}
            </div>
          ) : null}
        </div>
      </CanvasContextMenu>
      {marqueeStyle && <div className={styles.marquee} style={marqueeStyle} aria-hidden />}
    </div>
  )
}
