// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { SaveIndicator } from '@ui/topbar/SaveIndicator'

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
})

describe('SaveIndicator (L-TOP-05)', () => {
  it('shows the clean state when not dirty', () => {
    act(() => useDocumentStore.getState().markClean())
    act(() => root.render(<SaveIndicator />))
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-label')).toBe('All changes saved')
    expect(btn.textContent).not.toContain('*')
  })

  it('shows the dirty marker once the document is dirty', () => {
    act(() => root.render(<SaveIndicator />))
    act(() => useDocumentStore.getState().markDirty())
    const btn = container.querySelector('button')!
    expect(btn.getAttribute('aria-label')).toBe('Unsaved changes, click to save')
    expect(btn.textContent).toContain('*')
  })
})
