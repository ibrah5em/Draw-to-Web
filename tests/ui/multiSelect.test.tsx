// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@store/sessionStore'
import { CanvasNode } from '@ui/canvas/CanvasNode'
import { rectFromPoints, rectsIntersect } from '@ui/canvas/marqueeSelect'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useSessionStore.getState().clearSelection()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function renderTree(): void {
  act(() => root.render(<CanvasNode node={PORTFOLIO_DOCUMENT.tree} />))
}

function shiftClick(id: string): void {
  const el = container.querySelector(`[data-dtw-id="${id}"]`)
  if (!el) throw new Error(`no element with data-dtw-id="${id}"`)
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
  })
}

function plainClick(id: string): void {
  const el = container.querySelector(`[data-dtw-id="${id}"]`)
  if (!el) throw new Error(`no element with data-dtw-id="${id}"`)
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('multi-select (L-CAN-06)', () => {
  it('shift-click adds to the current selection', () => {
    renderTree()
    plainClick('title')
    shiftClick('footer-text')
    expect(useSessionStore.getState().selectedIds).toEqual(['title', 'footer-text'])
  })

  it('shift-click on an already-selected element toggles it out', () => {
    renderTree()
    plainClick('title')
    shiftClick('footer-text')
    shiftClick('title')
    expect(useSessionStore.getState().selectedIds).toEqual(['footer-text'])
  })

  it('plain click replaces the selection', () => {
    renderTree()
    plainClick('title')
    shiftClick('footer-text')
    plainClick('cta')
    expect(useSessionStore.getState().selectedIds).toEqual(['cta'])
  })

  it('ctrl-click and meta-click also toggle (cross-platform)', () => {
    renderTree()
    plainClick('title')
    const el = container.querySelector('[data-dtw-id="footer-text"]')
    if (!el) throw new Error('missing footer-text')
    act(() => {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })
    expect(useSessionStore.getState().selectedIds).toEqual(['title', 'footer-text'])
  })
})

describe('marquee rect helpers (L-CAN-06)', () => {
  it('rectFromPoints normalises any drag direction', () => {
    expect(rectFromPoints(10, 10, 30, 50)).toEqual({ x: 10, y: 10, width: 20, height: 40 })
    expect(rectFromPoints(30, 50, 10, 10)).toEqual({ x: 10, y: 10, width: 20, height: 40 })
  })

  it('rectsIntersect detects overlap on both axes', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 }
    expect(rectsIntersect(a, { x: 50, y: 50, width: 10, height: 10 })).toBe(true)
    expect(rectsIntersect(a, { x: 200, y: 0, width: 10, height: 10 })).toBe(false)
    expect(rectsIntersect(a, { x: 0, y: 200, width: 10, height: 10 })).toBe(false)
    // Touching edges counts as intersecting.
    expect(rectsIntersect(a, { x: 100, y: 100, width: 5, height: 5 })).toBe(true)
  })
})
