// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { useSessionStore } from '@store/sessionStore'
import { CanvasNode } from '@ui/canvas/CanvasNode'

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

function renderNode(node: ElementNode): void {
  act(() => {
    root.render(<CanvasNode node={node} />)
  })
}

function clickNode(id: string): void {
  const el = container.querySelector(`[data-dtw-id="${id}"]`)
  if (!el) throw new Error(`no element with data-dtw-id="${id}"`)
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('canvas selection (L-CAN-05)', () => {
  it('records the clicked element id in the session store', () => {
    renderNode(PORTFOLIO_DOCUMENT.tree)
    clickNode('title')
    expect(useSessionStore.getState().selectedIds).toEqual(['title'])
  })

  it('selects the deepest clicked element, not its ancestor container', () => {
    renderNode(PORTFOLIO_DOCUMENT.tree)
    clickNode('cta')
    expect(useSessionStore.getState().selectedIds).toEqual(['cta'])
  })

  it('replaces the prior selection on a new click', () => {
    renderNode(PORTFOLIO_DOCUMENT.tree)
    clickNode('title')
    clickNode('footer-text')
    expect(useSessionStore.getState().selectedIds).toEqual(['footer-text'])
  })
})
