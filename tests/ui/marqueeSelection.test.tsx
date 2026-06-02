// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'
import { Canvas } from '@ui/canvas/Canvas'
import { topmostMatches } from '@ui/canvas/marqueeSelect'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

describe('topmostMatches (m4)', () => {
  it('drops ancestors that contain another matched element', () => {
    const root = document.createElement('div')
    root.setAttribute('data-dtw-id', 'root')
    const child = document.createElement('div')
    child.setAttribute('data-dtw-id', 'child')
    root.appendChild(child)
    // Order shouldn't matter: ancestor first or last, only the leaf survives.
    expect(topmostMatches([root, child])).toEqual(['child'])
    expect(topmostMatches([child, root])).toEqual(['child'])
  })

  it('keeps sibling leaves that contain nothing matched', () => {
    const parent = document.createElement('div')
    const a = document.createElement('div')
    a.setAttribute('data-dtw-id', 'a')
    const b = document.createElement('div')
    b.setAttribute('data-dtw-id', 'b')
    parent.append(a, b)
    expect(topmostMatches([a, b])).toEqual(['a', 'b'])
  })
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
  useSessionStore.setState({ activeBreakpoint: 'base', activeState: 'default', theme: 'light' })
  useSessionStore.getState().clearSelection()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
  useSessionStore.getState().clearSelection()
})

/**
 * Faithfully replays a canvas node click: the pointerdown/pointerup pair
 * bubbles to the viewport (where the marquee handlers live) before the click
 * fires — the exact sequence that used to wipe the selection (M1).
 */
function pointerClick(id: string, opts: { shift?: boolean } = {}): void {
  const el = container.querySelector(`[data-dtw-id="${id}"]`)
  if (!el) throw new Error(`no element with data-dtw-id="${id}"`)
  act(() => {
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    el.dispatchEvent(new Event('pointerup', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: opts.shift }))
  })
}

describe('Canvas multi-select accumulation (M1)', () => {
  it('shift-click accumulates even though pointerup bubbles to the viewport', () => {
    act(() => root.render(<Canvas />))
    pointerClick('title')
    pointerClick('footer-text', { shift: true })
    expect(useSessionStore.getState().selectedIds).toEqual(['title', 'footer-text'])
  })

  it('ctrl-click also accumulates', () => {
    act(() => root.render(<Canvas />))
    pointerClick('title')
    const el = container.querySelector('[data-dtw-id="cta"]')
    if (!el) throw new Error('missing cta')
    act(() => {
      el.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      el.dispatchEvent(new Event('pointerup', { bubbles: true }))
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })
    expect(useSessionStore.getState().selectedIds).toEqual(['title', 'cta'])
  })

  it('plain click still replaces the selection', () => {
    act(() => root.render(<Canvas />))
    pointerClick('title')
    pointerClick('footer-text', { shift: true })
    pointerClick('cta')
    expect(useSessionStore.getState().selectedIds).toEqual(['cta'])
  })
})
