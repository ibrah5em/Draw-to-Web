// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { CanvasViewToggles } from '@ui/topbar/CanvasViewToggles'
import { useViewPrefs } from '@ui/state/viewPrefs'

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
  useViewPrefs.getState().setHoverPreview(false)
})

function button(label: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === label
  )
  if (!btn) throw new Error(`no button "${label}"`)
  return btn as HTMLButtonElement
}

describe('CanvasViewToggles (L-CAN-10 / L-TOP-06 / L-TOP-03)', () => {
  it('grid toggle flips document.settings.gridVisible', () => {
    // Blank doc defaults gridVisible true; toggle should turn it off.
    expect(useDocumentStore.getState().document.settings.gridVisible).toBe(true)
    act(() => root.render(<CanvasViewToggles />))
    act(() => button('Toggle grid overlay').click())
    expect(useDocumentStore.getState().document.settings.gridVisible).toBe(false)
  })

  it('hover toggle flips ephemeral viewPrefs without dirtying the document', () => {
    act(() => useDocumentStore.getState().markClean())
    act(() => root.render(<CanvasViewToggles />))
    act(() => button('Toggle hover preview').click())
    expect(useViewPrefs.getState().hoverPreview).toBe(true)
    // L-TOP-03 DoD: toggling hover preview does not mutate the document.
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })
})
