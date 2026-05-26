// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { ScalarTokenRow } from '@ui/panels/tokens/TokenRow'
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
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
})

/** Drive a controlled React input the way a user typing would. */
function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}

function spacingTokens() {
  return useDocumentStore.getState().document.tokens.spacing
}

describe('ScalarTokenRow (L-TKN-02)', () => {
  it('dispatches updateToken when the value is edited', () => {
    const token = spacingTokens()[0]
    act(() => root.render(<ScalarTokenRow category="spacing" token={token} />))
    const valueInput = container.querySelector(
      'input[aria-label="Token value"]'
    ) as HTMLInputElement
    typeInto(valueInput, '99px')
    expect(spacingTokens()[0].value).toBe('99px')
  })

  it('dispatches updateToken when the name is edited', () => {
    const token = spacingTokens()[0]
    act(() => root.render(<ScalarTokenRow category="spacing" token={token} />))
    const nameInput = container.querySelector('input[aria-label="Token name"]') as HTMLInputElement
    typeInto(nameInput, 'Tiny')
    expect(spacingTokens()[0].name).toBe('Tiny')
  })
})

describe('TokensPanel editing (L-TKN-02)', () => {
  it('removes a token when its delete button is clicked', () => {
    act(() => root.render(<TokensPanel collapsed={false} onToggleCollapse={() => {}} />))
    const before = useDocumentStore.getState().document.tokens.color
    const deleteFirst = container.querySelector(
      `button[aria-label="Delete ${before[0].name}"]`
    ) as HTMLButtonElement
    act(() => deleteFirst.click())
    const after = useDocumentStore.getState().document.tokens.color
    expect(after).toHaveLength(before.length - 1)
    expect(after.find((t) => t.id === before[0].id)).toBeUndefined()
  })

  it('renders light + dark color swatch pickers per color token', () => {
    act(() => root.render(<TokensPanel collapsed={false} onToggleCollapse={() => {}} />))
    const swatches = container.querySelectorAll('button[aria-label*="color"]')
    const colorCount = useDocumentStore.getState().document.tokens.color.length
    expect(swatches.length).toBe(colorCount * 2)
  })
})
