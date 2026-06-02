import { describe, expect, it } from 'vitest'

import { inferSemantics } from '@ui/canvas/inferSemantics'
import type { ContainerNode, ElementNode } from '../../src/document/types'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

function container(
  id: string,
  children: ElementNode[],
  role?: ContainerNode['semanticRole']
): ContainerNode {
  return {
    id,
    type: 'container',
    semanticRole: role,
    style: { base: {} },
    layout: { base: { mode: 'flex' } },
    children,
  }
}

function link(id: string, href: string): ElementNode {
  return { id, type: 'link', href, content: 'x', style: { base: {} } }
}

function findById(node: ElementNode, id: string): ElementNode | undefined {
  if (node.id === id) return node
  if (node.type !== 'container') return undefined
  for (const child of node.children) {
    const hit = findById(child, id)
    if (hit) return hit
  }
  return undefined
}

function roleOf(tree: ElementNode, id: string): string | undefined {
  const node = findById(tree, id)
  return node?.type === 'container' ? node.semanticRole : undefined
}

describe('inferSemantics (C10 adapter)', () => {
  it('preserves explicit roles set by presets / authors', () => {
    const out = inferSemantics(PORTFOLIO_DOCUMENT.tree)
    expect(roleOf(out, 'root')).toBe('main')
    expect(roleOf(out, 'header')).toBe('header')
    expect(roleOf(out, 'footer')).toBe('footer')
  })

  it('labels the root container as main when no role is set', () => {
    const tree = container('root', [container('a', []), container('b', [])])
    expect(roleOf(inferSemantics(tree), 'root')).toBe('main')
  })

  it('infers header for the first and footer for the last top-level region', () => {
    const tree = container('root', [
      container('first', []),
      container('middle', []),
      container('last', []),
    ])
    const out = inferSemantics(tree)
    expect(roleOf(out, 'first')).toBe('header')
    expect(roleOf(out, 'middle')).toBe('section')
    expect(roleOf(out, 'last')).toBe('footer')
  })

  it('infers nav for a container grouping two or more links', () => {
    const tree = container('root', [
      container('menu', [link('l1', '#a'), link('l2', '#b')]),
      container('body', []),
    ])
    expect(roleOf(inferSemantics(tree), 'menu')).toBe('nav')
  })

  it('is idempotent', () => {
    const once = inferSemantics(PORTFOLIO_DOCUMENT.tree)
    const twice = inferSemantics(once)
    expect(twice).toEqual(once)
  })

  it('re-annotating an annotated tree returns the identical reference (Y-PRF-01 sharing)', () => {
    const once = inferSemantics(PORTFOLIO_DOCUMENT.tree)
    // Nothing left to infer → no node is rebuilt → same reference throughout.
    expect(inferSemantics(once)).toBe(once)
  })

  it('preserves untouched sibling subtree references when one branch changes', () => {
    const out1 = inferSemantics(
      container('root', [
        container('left', [
          { id: 'lt', type: 'text', tag: 'p', content: 'hi', style: { base: {} } },
        ]),
        container('right', [
          { id: 'rt', type: 'text', tag: 'p', content: 'yo', style: { base: {} } },
        ]),
      ])
    ) as ContainerNode
    const left1 = out1.children[0] as ContainerNode
    const right1 = out1.children[1]

    // Mimic an immer edit: new root array, left replaced by an edited copy,
    // the right child kept by reference.
    const editedLeft: ContainerNode = {
      ...left1,
      children: [{ ...(left1.children[0] as ElementNode), content: 'edited' }],
    }
    const editedTree: ContainerNode = { ...out1, children: [editedLeft, right1] }

    const out2 = inferSemantics(editedTree) as ContainerNode
    expect(out2.children[1]).toBe(right1) // untouched sibling: same reference
    expect(out2.children[0]).not.toBe(left1) // edited branch: rebuilt
  })

  it('resolves identical roles for a copy-pasted subtree (new ids, same structure)', () => {
    const hero = container(
      'hero',
      [{ id: 'h-title', type: 'text', tag: 'h1', content: 'Hi', style: { base: {} } }],
      'section'
    )
    const copy: ContainerNode = {
      ...hero,
      id: 'hero-copy',
      children: hero.children.map((c) => ({ ...c, id: `${c.id}-copy` })),
    }
    const original = inferSemantics(container('root', [hero, container('foot', [])]))
    const pasted = inferSemantics(container('root', [copy, container('foot', [])]))
    expect(roleOf(original, 'hero')).toBe('section')
    expect(roleOf(pasted, 'hero-copy')).toBe(roleOf(original, 'hero'))
  })
})
