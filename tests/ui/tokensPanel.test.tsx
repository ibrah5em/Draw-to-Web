// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { TokensPanel } from '@ui/panels/tokens/TokensPanel'

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
})

function renderPanel(): void {
  act(() => root.render(<TokensPanel collapsed={false} onToggleCollapse={() => {}} />))
}

function tabByLabel(label: string): HTMLElement {
  const tab = [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === label)
  if (!tab) throw new Error(`no tab "${label}"`)
  return tab as HTMLElement
}

describe('TokensPanel (L-TKN-01)', () => {
  it('renders the five category tabs', () => {
    renderPanel()
    for (const label of ['Colors', 'Spacing', 'Typography', 'Shadows', 'Radii']) {
      expect(tabByLabel(label)).toBeTruthy()
    }
  })

  it('lists color tokens from the document on the default tab', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    renderPanel()
    expect(container.textContent).toContain('Background')
    expect(container.textContent).toContain('Accent')
  })

  it('shows spacing tokens after switching to the Spacing tab', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    renderPanel()
    act(() => {
      const tab = tabByLabel('Spacing')
      tab.focus()
      tab.click()
    })
    expect(container.textContent).toContain('Medium')
    expect(container.textContent).toContain('16px')
  })
})
