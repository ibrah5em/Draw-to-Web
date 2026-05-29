// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { TextNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
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
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
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

function getText(id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-dtw-id="${id}"]`)
  if (!el) throw new Error(`no element with data-dtw-id="${id}"`)
  return el
}

function findText(id: string): TextNode | null {
  let found: TextNode | null = null
  const walk = (n: TextNode | { children?: readonly TextNode[]; id: string }): void => {
    if ('id' in n && n.id === id && (n as TextNode).type === 'text') {
      found = n as TextNode
      return
    }
    const children = (n as { children?: readonly TextNode[] }).children
    if (Array.isArray(children)) {
      for (const c of children) walk(c)
    }
  }
  walk(useDocumentStore.getState().document.tree as unknown as TextNode)
  return found
}

function doubleClick(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
}

function blur(el: HTMLElement): void {
  // React's onBlur subscribes to the bubbling `focusout` event, not the
  // non-bubbling `blur`. Dispatch the right one so the handler actually
  // runs in jsdom.
  act(() => {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

describe('inline text edit (L-CAN-07)', () => {
  it('double-click switches the text node into contentEditable', () => {
    renderTree()
    const title = getText('title')
    expect(title.getAttribute('contenteditable')).toBeNull()
    doubleClick(title)
    expect(getText('title').getAttribute('contenteditable')).toBe('true')
  })

  it('blur dispatches updateNode and exits edit mode', () => {
    renderTree()
    const title = getText('title')
    doubleClick(title)
    const live = getText('title')
    act(() => {
      live.textContent = 'Hello, Anthropic'
    })
    blur(live)
    expect(findText('title')?.content).toBe('Hello, Anthropic')
    expect(getText('title').getAttribute('contenteditable')).toBeNull()
  })

  it('round-trips whitespace and special characters verbatim', () => {
    renderTree()
    const title = getText('title')
    doubleClick(title)
    const live = getText('title')
    const tricky = '  Mixed — space  & ä < ψ >\t  '
    act(() => {
      live.textContent = tricky
    })
    blur(live)
    expect(findText('title')?.content).toBe(tricky)
  })

  it('no-op blur does not dispatch when content is unchanged', () => {
    renderTree()
    const before = useHistoryStore.getState().past.length
    const title = getText('title')
    doubleClick(title)
    const live = getText('title')
    blur(live)
    expect(useHistoryStore.getState().past.length).toBe(before)
  })
})
