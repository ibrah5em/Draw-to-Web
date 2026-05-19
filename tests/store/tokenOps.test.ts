import { beforeEach, describe, expect, it } from 'vitest'

import type { ContainerNode, Document, TextNode } from '../../src/document/types'
import { undo } from '../../src/store/dispatch'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import { findElementById } from '../../src/store/selectors'
import {
  addToken,
  deleteToken,
  findTokenDefinition,
  previewDeleteToken,
  renameToken,
  updateToken,
} from '../../src/store/tokenOps'

const ROOT_ID = 'root-id-'
const HEADING_ID = 'heading-'

/**
 * Fixture document with a single text node so token-binding tests can
 * attach a TokenRef to a real style slot.
 */
function buildFixture(): Document {
  const heading: TextNode = {
    id: HEADING_ID,
    type: 'text',
    tag: 'h1',
    content: 'Hello',
    style: { base: {} },
  }
  const root: ContainerNode = {
    id: ROOT_ID,
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [heading],
  }
  const base = createBlankDocument('Token ops fixture')
  return { ...base, tree: root }
}

const reset = (): void => {
  useDocumentStore.setState({ document: buildFixture(), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
}

describe('addToken', () => {
  beforeEach(reset)

  it('adds a color token and records one history entry', () => {
    addToken('color', {
      id: 'accent',
      name: 'Accent',
      value: { light: '#3b82f6', dark: '#60a5fa' },
    })
    const doc = useDocumentStore.getState().document
    expect(doc.tokens.color.find((t) => t.id === 'accent')).toBeDefined()
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('adds a non-color token via the same helper signature', () => {
    addToken('spacing', { id: 'md', name: 'Medium', value: '12px' })
    addToken('fontFamily', { id: 'sans', name: 'Sans', value: 'system-ui' })

    const doc = useDocumentStore.getState().document
    expect(doc.tokens.spacing.find((t) => t.id === 'md')?.value).toBe('12px')
    expect(doc.tokens.fontFamily.find((t) => t.id === 'sans')?.value).toBe('system-ui')
    expect(useHistoryStore.getState().past).toHaveLength(2)
  })

  it('undo restores the prior token list', () => {
    addToken('spacing', { id: 'lg', name: 'Large', value: '24px' })
    expect(undo()).toBe(true)
    expect(useDocumentStore.getState().document.tokens.spacing).toEqual([])
  })

  it('throws when the id is already in use', () => {
    addToken('spacing', { id: 'md', name: 'Medium', value: '12px' })
    expect(() => addToken('spacing', { id: 'md', name: 'Duplicate', value: '14px' })).toThrow(
      /already exists/
    )
  })
})

describe('updateToken', () => {
  beforeEach(() => {
    reset()
    addToken('color', {
      id: 'fg',
      name: 'Foreground',
      value: { light: '#111', dark: '#eee' },
    })
    addToken('spacing', { id: 'md', name: 'Medium', value: '12px' })
    useHistoryStore.setState({ past: [], future: [] })
  })

  it('partial color update — value only', () => {
    updateToken('color', 'fg', { value: { light: '#000', dark: '#fff' } })
    const def = findTokenDefinition(useDocumentStore.getState().document.tokens, 'color', 'fg')
    expect(def?.value).toEqual({ light: '#000', dark: '#fff' })
    expect(def?.name).toBe('Foreground')
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('partial color update — name and description only, value unchanged', () => {
    updateToken('color', 'fg', { name: 'Body Text', description: 'Default body color' })
    const def = findTokenDefinition(useDocumentStore.getState().document.tokens, 'color', 'fg')
    expect(def?.name).toBe('Body Text')
    expect(def?.description).toBe('Default body color')
    expect(def?.value).toEqual({ light: '#111', dark: '#eee' })
  })

  it('non-color update', () => {
    updateToken('spacing', 'md', { value: '16px' })
    const def = findTokenDefinition(useDocumentStore.getState().document.tokens, 'spacing', 'md')
    expect(def?.value).toBe('16px')
  })

  it('throws when the token does not exist', () => {
    expect(() => updateToken('color', 'nope', { value: { light: '#000', dark: '#fff' } })).toThrow(
      /not found/
    )
  })
})

describe('renameToken', () => {
  beforeEach(() => {
    reset()
    addToken('color', {
      id: 'old-name',
      name: 'Old',
      value: { light: '#000', dark: '#fff' },
    })
    // Bind the heading's color to the token.
    useDocumentStore.setState((s) => {
      const next = JSON.parse(JSON.stringify(s.document)) as Document
      const heading = findElementById(next.tree, HEADING_ID)
      if (heading !== null) {
        const mutable = heading as TextNode & {
          style: { base: { typography?: { color?: string } } }
        }
        mutable.style.base.typography = { color: 'color.old-name' }
      }
      return { document: next, isDirty: false }
    })
    useHistoryStore.setState({ past: [], future: [] })
  })

  it('rewrites bindings in the tree and records exactly one history entry', () => {
    renameToken('color', 'old-name', 'new-name')
    const heading = findElementById(useDocumentStore.getState().document.tree, HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('color.new-name')
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('undo reverses both the rename and the binding rewrite atomically', () => {
    renameToken('color', 'old-name', 'new-name')
    undo()
    const doc = useDocumentStore.getState().document
    const heading = findElementById(doc.tree, HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('color.old-name')
    expect(doc.tokens.color.find((t) => t.id === 'old-name')).toBeDefined()
    expect(doc.tokens.color.find((t) => t.id === 'new-name')).toBeUndefined()
  })

  it('renaming to the same id is a no-op (no history entry)', () => {
    renameToken('color', 'old-name', 'old-name')
    expect(useHistoryStore.getState().past).toHaveLength(0)
  })

  it('throws when the target id is already in use', () => {
    addToken('color', {
      id: 'taken',
      name: 'Taken',
      value: { light: '#aaa', dark: '#bbb' },
    })
    useHistoryStore.setState({ past: [], future: [] })
    expect(() => renameToken('color', 'old-name', 'taken')).toThrow(/already exists/)
  })
})

describe('previewDeleteToken', () => {
  beforeEach(() => {
    reset()
    addToken('color', {
      id: 'accent',
      name: 'Accent',
      value: { light: '#3b82f6', dark: '#60a5fa' },
    })
  })

  it('reports zero bindings when nothing references the token', () => {
    const preview = previewDeleteToken('color', 'accent')
    expect(preview.bindingCount).toBe(0)
    expect(preview.frozenValue).toBe('#3b82f6')
  })

  it('counts every binding in the tree', () => {
    // Inject two bindings on the heading: typography.color and a state override.
    useDocumentStore.setState((s) => {
      const next = JSON.parse(JSON.stringify(s.document)) as Document
      const heading = findElementById(next.tree, HEADING_ID)
      if (heading !== null) {
        const mutable = heading as TextNode & {
          style: { base: { typography?: { color?: string }; background?: unknown[] } }
        }
        mutable.style.base.typography = { color: 'color.accent' }
        mutable.style.base.background = [{ kind: 'solid', color: 'color.accent' }]
      }
      return { document: next }
    })

    const preview = previewDeleteToken('color', 'accent')
    expect(preview.bindingCount).toBe(2)
    expect(preview.frozenValue).toBe('#3b82f6')
  })

  it('returns the raw string value for non-color tokens', () => {
    addToken('spacing', { id: 'md', name: 'Medium', value: '12px' })
    const preview = previewDeleteToken('spacing', 'md')
    expect(preview.frozenValue).toBe('12px')
  })

  it('does NOT mutate the store or record a history entry', () => {
    const docBefore = useDocumentStore.getState().document
    const histBefore = useHistoryStore.getState().past.length
    previewDeleteToken('color', 'accent')
    expect(useDocumentStore.getState().document).toBe(docBefore)
    expect(useHistoryStore.getState().past).toHaveLength(histBefore)
  })

  it('reports null frozenValue when the token does not exist', () => {
    const preview = previewDeleteToken('color', 'nonexistent')
    expect(preview.bindingCount).toBe(0)
    expect(preview.frozenValue).toBeNull()
  })
})

describe('deleteToken', () => {
  beforeEach(() => {
    reset()
    addToken('color', {
      id: 'accent',
      name: 'Accent',
      value: { light: '#3b82f6', dark: '#60a5fa' },
    })
    // Bind the heading's color to the token so the freeze rewrite is exercised.
    useDocumentStore.setState((s) => {
      const next = JSON.parse(JSON.stringify(s.document)) as Document
      const heading = findElementById(next.tree, HEADING_ID)
      if (heading !== null) {
        const mutable = heading as TextNode & {
          style: { base: { typography?: { color?: string } } }
        }
        mutable.style.base.typography = { color: 'color.accent' }
      }
      return { document: next, isDirty: false }
    })
    useHistoryStore.setState({ past: [], future: [] })
  })

  it('drops the token and freezes the light-theme value into bindings — one history entry', () => {
    deleteToken('color', 'accent')
    const doc = useDocumentStore.getState().document
    expect(doc.tokens.color.find((t) => t.id === 'accent')).toBeUndefined()
    const heading = findElementById(doc.tree, HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('#3b82f6')
    expect(useHistoryStore.getState().past).toHaveLength(1)
  })

  it('undo restores the token definition AND the binding ref', () => {
    deleteToken('color', 'accent')
    undo()
    const doc = useDocumentStore.getState().document
    expect(doc.tokens.color.find((t) => t.id === 'accent')).toBeDefined()
    const heading = findElementById(doc.tree, HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('color.accent')
  })

  it('throws when the token does not exist', () => {
    expect(() => deleteToken('color', 'nope')).toThrow(/not found/)
  })
})
