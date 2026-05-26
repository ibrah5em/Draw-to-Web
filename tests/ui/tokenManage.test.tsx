// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
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
  act(() => root.render(<TokensPanel collapsed={false} onToggleCollapse={() => {}} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
})

function colorTokens() {
  return useDocumentStore.getState().document.tokens.color
}

function buttonByText(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
  if (!btn) throw new Error(`no button containing "${text}"`)
  return btn as HTMLButtonElement
}

function idInputWithValue(value: string): HTMLInputElement {
  const input = [...container.querySelectorAll('input[aria-label="Token id"]')].find(
    (i) => (i as HTMLInputElement).value === value
  )
  if (!input) throw new Error(`no id input with value "${value}"`)
  return input as HTMLInputElement
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}

describe('Tokens add (L-TKN-04)', () => {
  it('adds a color token via the Add color button', () => {
    const before = colorTokens().length
    act(() => buttonByText('Add color').click())
    const after = colorTokens()
    expect(after).toHaveLength(before + 1)
    expect(after.some((t) => t.id === 'token-1')).toBe(true)
  })
})

describe('Tokens rename (L-TKN-04)', () => {
  it('renames the id, rewrites tree bindings, in one history entry', () => {
    const historyBefore = useHistoryStore.getState().past.length
    const input = idInputWithValue('accent')
    typeInto(input, 'brand')
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))

    const tree = JSON.stringify(useDocumentStore.getState().document.tree)
    expect(colorTokens().some((t) => t.id === 'brand')).toBe(true)
    expect(colorTokens().some((t) => t.id === 'accent')).toBe(false)
    expect(tree).toContain('color.brand')
    expect(tree).not.toContain('color.accent')
    expect(useHistoryStore.getState().past.length).toBe(historyBefore + 1)
  })

  it('reverts an invalid id without renaming', () => {
    const input = idInputWithValue('bg')
    typeInto(input, 'has spaces')
    act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(colorTokens().some((t) => t.id === 'bg')).toBe(true)
  })
})

describe('Tokens contrast badge (L-TKN-03)', () => {
  it('renders a contrast badge for color tokens', () => {
    const badges = container.querySelectorAll('[title^="Contrast"]')
    expect(badges.length).toBeGreaterThan(0)
  })
})
