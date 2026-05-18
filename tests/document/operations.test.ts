import { applyPatches, enablePatches, produceWithPatches } from 'immer'
import { beforeAll, describe, expect, it } from 'vitest'

import { applyOperation, type Operation } from '../../src/document/operations'
import type { Document, ElementNode } from '../../src/document/types'

beforeAll(() => {
  enablePatches()
})

/** Minimal document used as the test base. */
function makeDocument(): Document {
  return {
    version: '0.2.0',
    meta: {
      name: 'Test',
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
    },
    tokens: {
      color: [{ id: 'accent', name: 'Accent', value: { light: '#3b82f6', dark: '#60a5fa' } }],
      spacing: [{ id: 'md', name: 'Medium', value: '1rem' }],
      fontSize: [],
      fontFamily: [],
      lineHeight: [],
      radius: [],
      shadow: [],
    },
    tree: {
      type: 'container',
      id: 'root',
      layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
      style: { base: {} },
      children: [
        {
          type: 'text',
          id: 'title',
          tag: 'h1',
          content: 'Hello',
          style: { base: { typography: { color: 'color.accent' } } },
        },
        {
          type: 'text',
          id: 'sub',
          tag: 'p',
          content: 'World',
          style: { base: {} },
        },
      ],
    },
    seo: {
      title: 'Test',
      description: 'Test doc',
      lang: 'en',
      viewport: 'width=device-width, initial-scale=1',
      charset: 'utf-8',
    },
    runtime: {
      themeToggle: false,
      scrollSpy: false,
      smoothScroll: false,
      mobileNav: false,
      navOnScroll: false,
      reveals: false,
      animationGating: false,
      terminalTyping: false,
    },
    variables: {},
    settings: { contrastTarget: 'AA', defaultTheme: 'auto', gridVisible: false },
    assets: {},
  }
}

/**
 * Run an op through `produceWithPatches` and assert the inverse patches
 * round-trip the document back to its pre-op state. This is the
 * DoD-required "insert → undo equals pristine" check, generalised across
 * every operation kind.
 */
function expectReversible(doc: Document, op: Operation): Document {
  const [next, , inverse] = produceWithPatches(doc, (draft) => {
    applyOperation(draft, op)
  })
  const restored = applyPatches(next, inverse)
  expect(restored).toEqual(doc)
  return next
}

describe('applyOperation (C3)', () => {
  describe('insertElement', () => {
    it('inserts at index and is reversible', () => {
      const doc = makeDocument()
      const newNode: ElementNode = {
        type: 'text',
        id: 'inserted',
        tag: 'p',
        content: 'New',
        style: { base: {} },
      }
      const next = expectReversible(doc, {
        kind: 'insertElement',
        parentId: 'root',
        node: newNode,
        index: 1,
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children.map((c) => c.id)).toEqual(['title', 'inserted', 'sub'])
    })

    it('appends when index is omitted', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'insertElement',
        parentId: 'root',
        node: { type: 'divider', id: 'd1', orientation: 'horizontal', style: { base: {} } },
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children[root.children.length - 1]!.id).toBe('d1')
    })

    it('throws on a non-container parent', () => {
      const doc = makeDocument()
      expect(() =>
        produceWithPatches(doc, (draft) => {
          applyOperation(draft, {
            kind: 'insertElement',
            parentId: 'title',
            node: { type: 'divider', id: 'x', orientation: 'horizontal', style: { base: {} } },
          })
        })
      ).toThrow(/not a container/)
    })
  })

  describe('deleteElement', () => {
    it('removes a node and is reversible', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, { kind: 'deleteElement', id: 'sub' })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children.map((c) => c.id)).toEqual(['title'])
    })

    it('refuses to delete the root', () => {
      const doc = makeDocument()
      expect(() =>
        produceWithPatches(doc, (draft) => {
          applyOperation(draft, { kind: 'deleteElement', id: 'root' })
        })
      ).toThrow(/root/)
    })
  })

  describe('reorder', () => {
    it('reorders within a parent and is reversible', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, { kind: 'reorder', id: 'title', toIndex: 1 })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children.map((c) => c.id)).toEqual(['sub', 'title'])
    })
  })

  describe('updateNode / updateNodeStyle / updateNodeState', () => {
    it('writes into a leaf node and is reversible', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'updateNode',
        id: 'title',
        path: ['content'],
        value: 'Hello world',
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const title = root.children[0]
      if (title?.type !== 'text') throw new Error('expected text')
      expect(title.content).toBe('Hello world')
    })

    it('writes into a breakpoint slot without touching base', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'updateNodeStyle',
        id: 'title',
        breakpoint: 'mobile',
        path: ['typography', 'fontSize'],
        value: '1.25rem',
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const title = root.children[0]
      if (title?.type !== 'text') throw new Error('expected text')
      expect(title.style.base.typography?.fontSize).toBeUndefined()
      expect(title.style.mobile?.typography?.fontSize).toBe('1.25rem')
    })

    it('writes into a state slot', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'updateNodeState',
        id: 'title',
        state: 'hover',
        path: ['opacity'],
        value: 0.7,
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const title = root.children[0]
      if (title?.type !== 'text') throw new Error('expected text')
      expect(title.states?.hover?.opacity).toBe(0.7)
    })
  })

  describe('wrapInGroup / unwrapGroup', () => {
    it('wraps siblings into a new container at the first sibling position', () => {
      const doc = makeDocument()
      const groupTemplate: ElementNode = {
        type: 'container',
        id: 'group-1',
        layout: { base: { mode: 'flex' } },
        style: { base: {} },
        children: [],
      }
      const next = expectReversible(doc, {
        kind: 'wrapInGroup',
        ids: ['sub', 'title'],
        container: groupTemplate,
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children.length).toBe(1)
      const group = root.children[0]
      if (group?.type !== 'container') throw new Error('expected container')
      expect(group.id).toBe('group-1')
      expect(group.children.map((c) => c.id)).toEqual(['title', 'sub'])
    })

    it('unwraps a container back into its parent', () => {
      const wrapped = produceWithPatches(makeDocument(), (draft) => {
        applyOperation(draft, {
          kind: 'wrapInGroup',
          ids: ['title', 'sub'],
          container: {
            type: 'container',
            id: 'g',
            layout: { base: { mode: 'flex' } },
            style: { base: {} },
            children: [],
          },
        })
      })[0]

      const next = expectReversible(wrapped, { kind: 'unwrapGroup', id: 'g' })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      expect(root.children.map((c) => c.id)).toEqual(['title', 'sub'])
    })
  })

  describe('token operations', () => {
    it('adds a token (reversible)', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'addToken',
        category: 'spacing',
        definition: { id: 'lg', name: 'Large', value: '2rem' },
      })
      expect(next.tokens.spacing.map((t) => t.id)).toEqual(['md', 'lg'])
    })

    it('updates an existing token value', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'updateToken',
        category: 'spacing',
        id: 'md',
        value: '1.25rem',
      })
      expect(next.tokens.spacing[0]!.value).toBe('1.25rem')
    })

    it('renames a token and rewrites every binding in the tree', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'renameToken',
        category: 'color',
        oldId: 'accent',
        newId: 'brand',
      })
      expect(next.tokens.color[0]!.id).toBe('brand')
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const title = root.children[0]
      if (title?.type !== 'text') throw new Error('expected text')
      expect(title.style.base.typography?.color).toBe('color.brand')
    })

    it('deletes a token and freezes the resolved (light) value into every binding', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'deleteToken',
        category: 'color',
        id: 'accent',
      })
      expect(next.tokens.color).toEqual([])
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const title = root.children[0]
      if (title?.type !== 'text') throw new Error('expected text')
      // Light variant frozen in; dark variant lost (the trade-off of deleting).
      expect(title.style.base.typography?.color).toBe('#3b82f6')
    })

    it('throws on duplicate addToken', () => {
      const doc = makeDocument()
      expect(() =>
        produceWithPatches(doc, (draft) => {
          applyOperation(draft, {
            kind: 'addToken',
            category: 'spacing',
            definition: { id: 'md', name: 'duplicate', value: '0' },
          })
        })
      ).toThrow(/already exists/)
    })
  })

  describe('insertPreset', () => {
    it('materializes a preset under the parent and is reversible', () => {
      const doc = makeDocument()
      const next = expectReversible(doc, {
        kind: 'insertPreset',
        parentId: 'root',
        presetId: 'cta-banner',
      })
      const root = next.tree
      if (root.type !== 'container') throw new Error('expected container')
      const inserted = root.children[root.children.length - 1]
      if (inserted?.type !== 'container') throw new Error('expected container')
      expect(inserted.name).toBe('CTA banner')
    })

    it('throws on an unknown preset id', () => {
      const doc = makeDocument()
      expect(() =>
        produceWithPatches(doc, (draft) => {
          applyOperation(draft, {
            kind: 'insertPreset',
            parentId: 'root',
            presetId: 'bogus',
          })
        })
      ).toThrow(/Unknown preset id/)
    })
  })

  it('throws on an unknown element id', () => {
    const doc = makeDocument()
    expect(() =>
      produceWithPatches(doc, (draft) => {
        applyOperation(draft, { kind: 'deleteElement', id: 'ghost' })
      })
    ).toThrow(/No element with id "ghost"/)
  })
})
