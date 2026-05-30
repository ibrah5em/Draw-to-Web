// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'
import { ValidationConsole } from '@ui/panels/validation/ValidationConsole'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
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

function render(): void {
  act(() => root.render(<ValidationConsole />))
}

describe('ValidationConsole (L-VAL-01..02)', () => {
  it('reports the missing-h1 error on a blank document', () => {
    render()
    // Blank doc has no <h1> — that is a validation error.
    expect(container.textContent).toContain('missing an <h1>')
  })

  it('does not report the missing-h1 error for the portfolio fixture', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    render()
    // The portfolio fixture has exactly one <h1>, so the blocking error is
    // absent (it may still surface info-level unused-token notes).
    expect(container.textContent).not.toContain('missing an <h1>')
  })

  it('updates live when the document mutates', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    render()
    expect(container.textContent).not.toContain('missing an <h1>')
    // Mutate to an invalid state: blank reset drops the single <h1>.
    act(() => useDocumentStore.getState().reset())
    expect(container.textContent).toContain('missing an <h1>')
  })

  it('jump-to-element selects the offending node (L-VAL-02)', () => {
    // Build a doc with a duplicate id so the issue carries a nodeId.
    const base = useDocumentStore.getState().document
    const dupId = 'dup12345'
    const child = {
      id: dupId,
      type: 'text' as const,
      tag: 'h1' as const,
      content: 'Title',
      style: { base: {} },
    }
    const tree = {
      ...base.tree,
      type: 'container' as const,
      children: [child, { ...child }],
    }
    act(() => useDocumentStore.getState().hydrate({ ...base, tree }))
    render()

    const jumpBtn = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Duplicate element')
    )
    expect(jumpBtn).toBeTruthy()
    act(() => jumpBtn!.click())
    expect(useSessionStore.getState().selectedIds).toEqual([dupId])
  })
})
