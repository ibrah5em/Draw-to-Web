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

function text(id: string, tag: 'p' | 'h1' | 'h2', content: string): ElementNode {
  return { id, type: 'text', tag, content, style: { base: {} } }
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

  it('infers header for a nav-bearing first region and footer for the trailing region', () => {
    const tree = container('root', [
      container('top', [container('navbar', [link('l1', '#a'), link('l2', '#b')])]),
      container('about', [text('about-h', 'h2', 'About')]),
      container('foot', [text('fp', 'p', '© 2026')]),
    ])
    const out = inferSemantics(tree)
    expect(roleOf(out, 'top')).toBe('header') // first region wrapping a nav
    expect(roleOf(out, 'navbar')).toBe('nav') // the nav group itself
    expect(roleOf(out, 'about')).toBe('section')
    expect(roleOf(out, 'foot')).toBe('footer') // trailing region, content, no heading
  })

  it('does not tag a hero-first section as header when there is no nav signal (m3)', () => {
    const tree = container('root', [
      container('hero', [text('hero-h', 'h1', 'Hi')]),
      container('foot', [text('fp', 'p', '©')]),
    ])
    expect(roleOf(inferSemantics(tree), 'hero')).toBe('section')
  })

  it('infers nav for a container grouping two or more links', () => {
    const tree = container('root', [
      container('menu', [link('l1', '#a'), link('l2', '#b')]),
      container('body', []),
    ])
    expect(roleOf(inferSemantics(tree), 'menu')).toBe('nav')
  })

  it('infers nav for only the first qualifying group, not every link list (m3)', () => {
    const tree = container('root', [
      container('primary', [link('a', '#1'), link('b', '#2')]),
      container('mid', []),
      container('social', [link('c', '#3'), link('d', '#4')]),
    ])
    const out = inferSemantics(tree)
    expect(roleOf(out, 'primary')).toBe('nav')
    expect(roleOf(out, 'social')).not.toBe('nav')
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
