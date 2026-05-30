// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { ExportButton } from '@ui/topbar/ExportButton'

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
  document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove())
  useDocumentStore.getState().reset()
})

function render(): void {
  act(() => root.render(<ExportButton />))
}

function exportTrigger(): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === 'Export'
  )
  if (!btn) throw new Error('no export button')
  return btn as HTMLButtonElement
}

describe('ExportButton (L-TOP-04 / L-VAL-03)', () => {
  it('is disabled while the document has validation errors', () => {
    // Blank document has no <h1> → blocking error.
    render()
    const btn = exportTrigger()
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('Fix the validation errors')
  })

  it('is enabled when the document validates clean', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    render()
    expect(exportTrigger().disabled).toBe(false)
  })

  it('opens the Export Options dialog when clicked', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    render()
    act(() => exportTrigger().click())
    expect(document.body.textContent).toContain('Export options')
    expect(document.body.textContent).toContain('Output filename')
  })
})
