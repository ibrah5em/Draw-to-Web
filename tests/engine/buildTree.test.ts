import { describe, it, expect } from 'vitest'
import { buildContainmentTree } from '../../src/engine/buildTree'
import type { CanvasElement } from '../../src/store/elementStore'

function el(id: string, x: number, y: number, width: number, height: number): CanvasElement {
  return { id, type: 'rectangle', x, y, width, height, props: {} }
}

describe('buildContainmentTree', () => {
  it('returns an empty array for empty input', () => {
    expect(buildContainmentTree([])).toEqual([])
  })

  it('returns a single root node for a single element', () => {
    const result = buildContainmentTree([el('a', 0, 0, 12, 100)])
    expect(result).toHaveLength(1)
    expect(result[0].element.id).toBe('a')
    expect(result[0].children).toHaveLength(0)
  })

  it('detects containment: child element is nested under its parent', () => {
    const parent = el('parent', 0, 0, 12, 500)
    const child = el('child', 1, 10, 4, 80)
    const [root] = buildContainmentTree([parent, child])
    expect(root.element.id).toBe('parent')
    expect(root.children).toHaveLength(1)
    expect(root.children[0].element.id).toBe('child')
  })

  it('two non-overlapping elements are both root nodes', () => {
    const a = el('a', 0, 0, 6, 100)
    const b = el('b', 6, 0, 6, 100)
    const roots = buildContainmentTree([a, b])
    expect(roots).toHaveLength(2)
    expect(roots.map((r) => r.element.id).sort()).toEqual(['a', 'b'])
  })

  it('handles three levels of nesting (A > B > C)', () => {
    const a = el('a', 0, 0, 12, 500)
    const b = el('b', 1, 10, 10, 400)
    const c = el('c', 2, 20, 6, 100)
    const [root] = buildContainmentTree([a, b, c])
    expect(root.element.id).toBe('a')
    expect(root.children).toHaveLength(1)
    expect(root.children[0].element.id).toBe('b')
    expect(root.children[0].children).toHaveLength(1)
    expect(root.children[0].children[0].element.id).toBe('c')
  })

  it('assigns child to the smallest container, not an outer wrapper', () => {
    const outer = el('outer', 0, 0, 12, 600)
    const inner = el('inner', 1, 10, 8, 300)
    const child = el('child', 2, 20, 4, 100)
    const [root] = buildContainmentTree([outer, inner, child])
    expect(root.element.id).toBe('outer')
    // inner is a child of outer
    const innerNode = root.children.find((n) => n.element.id === 'inner')
    expect(innerNode).toBeDefined()
    // child should be under inner, not outer
    expect(innerNode!.children[0].element.id).toBe('child')
    expect(root.children.find((n) => n.element.id === 'child')).toBeUndefined()
  })

  it('sorts children top-to-bottom, then left-to-right', () => {
    const parent = el('p', 0, 0, 12, 500)
    const c1 = el('c1', 6, 200, 4, 50) // right, lower
    const c2 = el('c2', 0, 100, 4, 50) // left, higher
    const c3 = el('c3', 4, 100, 4, 50) // right of c2, same y

    const [root] = buildContainmentTree([parent, c1, c2, c3])
    const ids = root.children.map((n) => n.element.id)
    // c2 and c3 share y=100; c2 (x=0) before c3 (x=4); then c1 (y=200)
    expect(ids).toEqual(['c2', 'c3', 'c1'])
  })

  it('root nodes are sorted top-to-bottom, left-to-right', () => {
    const a = el('a', 4, 100, 4, 50)
    const b = el('b', 0, 0, 4, 50)
    const c = el('c', 0, 100, 4, 50)
    const roots = buildContainmentTree([a, b, c])
    expect(roots.map((r) => r.element.id)).toEqual(['b', 'c', 'a'])
  })
})
