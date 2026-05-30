// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { documentSchema } from '@document/schemas'
import { useDocumentStore } from '@store/documentStore'
import { commitDocumentPatch } from '@ui/panels/document-settings/applySettings'
import { DocumentSettings } from '@ui/dialogs/DocumentSettings'

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

describe('commitDocumentPatch (L-DLG-02 round-trip through Zod)', () => {
  it('applies a valid patch and marks the document dirty', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    commitDocumentPatch((doc) => ({ ...doc, seo: { ...doc.seo, author: 'Ada' } }))
    expect(useDocumentStore.getState().document.seo.author).toBe('Ada')
    expect(useDocumentStore.getState().isDirty).toBe(true)
    // The committed document still parses against the schema.
    expect(() => documentSchema.parse(useDocumentStore.getState().document)).not.toThrow()
  })

  it('rejects an invalid patch without mutating the store', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    const before = useDocumentStore.getState().document
    expect(() =>
      // lang must be a string; force an invalid shape past the types for the test.
      commitDocumentPatch((doc) => ({
        ...doc,
        seo: { ...doc.seo, lang: 123 as unknown as string },
      }))
    ).toThrow()
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('toggles a runtime flag through a valid patch', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    commitDocumentPatch((doc) => ({ ...doc, runtime: { ...doc.runtime, themeToggle: true } }))
    expect(useDocumentStore.getState().document.runtime.themeToggle).toBe(true)
  })
})

describe('DocumentSettings dialog (L-DLG-02)', () => {
  it('renders the section tabs and seeds the title field', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    act(() => root.render(<DocumentSettings open onClose={() => {}} />))
    for (const label of ['Meta', 'Schema.org', 'Runtime', 'A11y', 'Variables']) {
      const tab = [...document.querySelectorAll('[role="tab"]')].find(
        (t) => t.textContent === label
      )
      expect(tab, `tab ${label}`).toBeTruthy()
    }
    const title = document.querySelector<HTMLInputElement>('input[aria-label="Title"]')
    expect(title?.value).toBe(PORTFOLIO_DOCUMENT.seo.title)
  })

  it('editing the title field commits through Zod to the store', () => {
    act(() => useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT))
    act(() => root.render(<DocumentSettings open onClose={() => {}} />))
    const title = document.querySelector<HTMLInputElement>('input[aria-label="Title"]')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    act(() => {
      setter.call(title, 'New Title')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(useDocumentStore.getState().document.seo.title).toBe('New Title')
  })
})
