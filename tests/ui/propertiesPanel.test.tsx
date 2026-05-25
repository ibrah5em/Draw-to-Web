// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { findElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { PropertiesPanel } from '@ui/panels/properties/PropertiesPanel'

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
  useSessionStore.setState({ activeBreakpoint: 'base', activeState: 'default', theme: 'light' })
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

function selectAndRender(id: string): void {
  useSessionStore.getState().setSelectedIds([id])
  act(() => root.render(<PropertiesPanel />))
}

function node(id: string): ElementNode {
  const found = findElementById(useDocumentStore.getState().document.tree, id)
  if (!found) throw new Error(`no node ${id}`)
  return found
}

function buttonByText(text: string, scope: ParentNode = container): HTMLButtonElement {
  const btn = [...scope.querySelectorAll('button')].find((b) => b.textContent?.includes(text))
  if (!btn) throw new Error(`no button containing "${text}"`)
  return btn as HTMLButtonElement
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}

function input(ariaLabel: string): HTMLInputElement {
  const el = container.querySelector(`input[aria-label="${ariaLabel}"]`)
  if (!el) throw new Error(`no input "${ariaLabel}"`)
  return el as HTMLInputElement
}

/** The bind button inside the field whose label matches. */
function fieldBindButton(label: string): HTMLButtonElement {
  const span = [...container.querySelectorAll('span')].find((s) => s.textContent === label)
  const field = span?.parentElement
  const btn = field?.querySelector('button[aria-label="Bind to token"]')
  if (!btn) throw new Error(`no bind button in field "${label}"`)
  return btn as HTMLButtonElement
}

describe('Layout controls (L-PRP-02)', () => {
  it('changes flex direction', () => {
    selectAndRender('header')
    act(() => buttonByText('Column').click())
    expect(node('header').type === 'container' && node('header')).toBeTruthy()
    const n = node('header')
    if (n.type !== 'container') throw new Error('not a container')
    expect(n.layout.base.direction).toBe('column')
  })

  it('edits gap as a raw value', () => {
    selectAndRender('header')
    typeInto(input('0'), '20px')
    const n = node('header')
    if (n.type !== 'container') throw new Error('not a container')
    expect(n.layout.base.gap).toBe('20px')
  })

  it('edits a padding side', () => {
    selectAndRender('header')
    typeInto(input('T'), '8px')
    expect(node('header').style.base.padding?.top).toBe('8px')
  })

  it('sets Fill sizing to width 100%', () => {
    selectAndRender('header')
    act(() => buttonByText('Fill').click())
    expect(node('header').style.base.width).toBe('100%')
  })
})

describe('Token binding (L-PRP-03)', () => {
  it('binds gap to a spacing token in one history entry', () => {
    selectAndRender('header')
    const before = useHistoryStore.getState().past.length
    act(() => fieldBindButton('Gap').click())
    act(() => buttonByText('Large', document.body).click())
    const n = node('header')
    if (n.type !== 'container') throw new Error('not a container')
    expect(n.layout.base.gap).toBe('spacing.lg')
    expect(useHistoryStore.getState().past.length).toBe(before + 1)
  })

  it('unlinks a bound gap back to a raw value in one history entry', () => {
    selectAndRender('root') // root.layout.base.gap = 'spacing.lg'
    const before = useHistoryStore.getState().past.length
    act(() => fieldBindButton('Gap').click())
    act(() => buttonByText('Unlink', document.body).click())
    const n = node('root')
    if (n.type !== 'container') throw new Error('not a container')
    expect(n.layout.base.gap).toBe('32px')
    expect(useHistoryStore.getState().past.length).toBe(before + 1)
  })
})

describe('Color picker + contrast (L-PRP-04)', () => {
  it('shows a contrast badge for a colored element', () => {
    selectAndRender('title')
    expect(container.querySelectorAll('[title^="Contrast"]').length).toBeGreaterThan(0)
  })

  it('toggles the AA/AAA target', () => {
    selectAndRender('title')
    const toggle = buttonByText('AA')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.textContent).toBe('AAA')
  })

  it('shows a failing badge with the target ratio when contrast is too low', () => {
    // Drop the bound text color to a near-white value so it fails vs the white surface.
    act(() =>
      useDocumentStore.getState().hydrate({
        ...PORTFOLIO_DOCUMENT,
        tokens: {
          ...PORTFOLIO_DOCUMENT.tokens,
          color: PORTFOLIO_DOCUMENT.tokens.color.map((t) =>
            t.id === 'text' ? { ...t, value: { light: '#dddddd', dark: '#dddddd' } } : t
          ),
        },
      })
    )
    selectAndRender('title')
    const badge = container.querySelector('[title^="Contrast"]')
    expect(badge?.textContent).toContain('needs 4.5:1')
  })
})
