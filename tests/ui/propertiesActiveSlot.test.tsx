// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Document, ElementNode } from '@document/types'
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
  useHistoryStore.getState().clear()
  useSessionStore.setState({ activeBreakpoint: 'base', activeState: 'default', theme: 'light' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.setState({ activeBreakpoint: 'base', activeState: 'default' })
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

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}

function firstInput(ariaLabel: string): HTMLInputElement {
  const el = container.querySelector(`input[aria-label="${ariaLabel}"]`)
  if (!el) throw new Error(`no input "${ariaLabel}"`)
  return el as HTMLInputElement
}

/** Hydrate a clone of the portfolio doc with one element patched. */
function hydratePatched(id: string, patch: (n: ElementNode) => ElementNode): void {
  const clone: Document = structuredClone(PORTFOLIO_DOCUMENT)
  const target = findElementById(clone.tree, id)
  if (!target) throw new Error(`no node ${id}`)
  Object.assign(target, patch(target))
  useDocumentStore.getState().hydrate(clone)
}

describe('Properties — reads resolve from the active state slot (C1)', () => {
  it('a Hover-tab edit routes to and displays from the hover slot (no revert)', () => {
    useSessionStore.setState({ activeState: 'hover' })
    selectAndRender('footer-text') // text node → only the Spacing section padding box

    const top = firstInput('T') // padding top
    expect(top.value).toBe('') // base has no padding.top
    typeInto(top, '12px')

    // Write landed in the hover slot, not base.
    const n = node('footer-text')
    expect(n.states?.hover?.padding?.top).toBe('12px')
    expect(n.style.base.padding?.top).toBeUndefined()

    // And the control now displays the hover value instead of snapping back to base.
    expect(firstInput('T').value).toBe('12px')
  })

  it('shows the hover slot value when the Hover tab is active', () => {
    hydratePatched('footer-text', (n) => ({
      ...n,
      states: { hover: { padding: { top: '20px' } } },
    }))
    useSessionStore.setState({ activeState: 'hover' })
    selectAndRender('footer-text')
    expect(firstInput('T').value).toBe('20px')
  })
})

describe('Properties — reads resolve from the active breakpoint slot (C1)', () => {
  it('shows the mobile width override, and the override badge agrees with the field', () => {
    hydratePatched('hero', (n) => ({
      ...n,
      style: { ...n.style, mobile: { width: '50%' } },
    }))
    useSessionStore.setState({ activeBreakpoint: 'mobile' })
    selectAndRender('hero')

    // Field reflects the mobile slot, not the base '100%'.
    expect(firstInput('Width').value).toBe('50%')
    // The per-field override badge is present — field + badge agree there is an override.
    expect(container.querySelector('[title^="Override"]')).not.toBeNull()
  })

  it('falls back to the base value when the active breakpoint has no override', () => {
    useSessionStore.setState({ activeBreakpoint: 'mobile' })
    selectAndRender('hero')
    expect(firstInput('Width').value).toBe('100%') // inherited from base
  })
})
