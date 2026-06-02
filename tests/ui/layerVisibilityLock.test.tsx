// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@store/sessionStore'
import { CanvasNode } from '@ui/canvas/CanvasNode'
import { useViewPrefs } from '@ui/state/viewPrefs'

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
  useViewPrefs.setState({ hiddenIds: new Set(), lockedIds: new Set() })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useSessionStore.getState().clearSelection()
  useViewPrefs.setState({ hiddenIds: new Set(), lockedIds: new Set() })
})

function renderTree(): void {
  act(() => root.render(<CanvasNode node={PORTFOLIO_DOCUMENT.tree} />))
}

function el(id: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-dtw-id="${id}"]`)
  if (!found) throw new Error(`no element with data-dtw-id="${id}"`)
  return found
}

function click(id: string): void {
  act(() => el(id).dispatchEvent(new MouseEvent('click', { bubbles: true })))
}

describe('Layers visibility (L-LYR-01)', () => {
  it('a hidden element is painted with display:none', () => {
    useViewPrefs.getState().toggleHidden('title')
    renderTree()
    expect(el('title').style.display).toBe('none')
  })

  it('visible elements are not display:none', () => {
    renderTree()
    expect(el('title').style.display).not.toBe('none')
  })
})

describe('Layers lock (L-LYR-01)', () => {
  it('a locked element ignores canvas click selection', () => {
    useViewPrefs.getState().toggleLocked('title')
    renderTree()
    click('title')
    expect(useSessionStore.getState().selectedIds).toEqual([])
  })

  it('an unlocked sibling still selects normally', () => {
    useViewPrefs.getState().toggleLocked('title')
    renderTree()
    click('cta')
    expect(useSessionStore.getState().selectedIds).toEqual(['cta'])
  })

  it('a locked element sheds its drag attributes (not draggable)', () => {
    useViewPrefs.getState().toggleLocked('title')
    renderTree()
    // useSortable sets role="button" via its attributes; locked strips them.
    expect(el('title').getAttribute('role')).toBeNull()
  })

  it('a locked text element does not enter inline edit on double-click', () => {
    useViewPrefs.getState().toggleLocked('title')
    renderTree()
    act(() => el('title').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
    expect(el('title').getAttribute('contenteditable')).toBeNull()
  })
})
