import { describe, expect, it } from 'vitest'

import type { ContainerNode } from '@document/types'
import {
  buildInsertOp,
  containerDropId,
  createPrimitive,
  parseContainerDropId,
  resolveChildDropTarget,
} from '@ui/sidebar/insertDrop'

let counter = 0
const stableId = (): string => `el_${++counter}`

/** root → [ text a, grid → [ text c1, text c2 ] ] */
function sampleTree(): ContainerNode {
  return {
    id: 'root',
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex' } },
    children: [
      { id: 'a', type: 'text', tag: 'p', content: 'a', style: { base: {} } },
      {
        id: 'grid',
        type: 'container',
        style: { base: {} },
        layout: { base: { mode: 'flex' } },
        children: [
          { id: 'c1', type: 'text', tag: 'p', content: 'c1', style: { base: {} } },
          { id: 'c2', type: 'text', tag: 'p', content: 'c2', style: { base: {} } },
        ],
      },
    ],
  }
}

describe('buildInsertOp (L-CAN-12)', () => {
  it('round-trips containerDropId', () => {
    const id = 'abc123'
    expect(parseContainerDropId(containerDropId(id))).toBe(id)
  })

  it('returns null when over is not a container drop target', () => {
    expect(buildInsertOp('insert:preset:hero-centered', 'other:thing:x', stableId)).toBeNull()
    expect(buildInsertOp('insert:preset:hero-centered', null, stableId)).toBeNull()
  })

  it('returns null when active is not an Insert drag', () => {
    expect(buildInsertOp('something-else', containerDropId('parent'), stableId)).toBeNull()
  })

  it('drops a preset card into a Grid container as insertPreset', () => {
    const op = buildInsertOp(
      'insert:preset:cards-grid-3col',
      containerDropId('grid-parent'),
      stableId
    )
    expect(op).toEqual({
      kind: 'insertPreset',
      parentId: 'grid-parent',
      presetId: 'cards-grid-3col',
    })
  })

  it('drops a primitive card as insertElement with a freshly-built node', () => {
    counter = 0
    const op = buildInsertOp('insert:element:text', containerDropId('parent-x'), stableId)
    expect(op?.kind).toBe('insertElement')
    if (op?.kind !== 'insertElement') throw new Error('expected insertElement')
    expect(op.parentId).toBe('parent-x')
    expect(op.node.type).toBe('text')
    expect(op.node.id).toBe('el_1')
  })

  it('rejects unknown preset ids', () => {
    expect(
      buildInsertOp('insert:preset:not-a-real-preset', containerDropId('p'), stableId)
    ).toBeNull()
  })
})

describe('buildInsertOp — explicit index (M3)', () => {
  it('threads the drop index into the insertElement op', () => {
    counter = 0
    const op = buildInsertOp('insert:element:text', containerDropId('grid'), stableId, 1)
    expect(op?.kind).toBe('insertElement')
    if (op?.kind !== 'insertElement') throw new Error('expected insertElement')
    expect(op.parentId).toBe('grid')
    expect(op.index).toBe(1)
  })

  it('threads the drop index into the insertPreset op', () => {
    const op = buildInsertOp('insert:preset:card-basic', containerDropId('grid'), stableId, 2)
    expect(op).toMatchObject({ kind: 'insertPreset', parentId: 'grid', index: 2 })
  })
})

describe('resolveChildDropTarget (M3)', () => {
  it('resolves a bare child id to its parent container and the slot after it', () => {
    expect(resolveChildDropTarget('c1', sampleTree())).toEqual({ parentId: 'grid', index: 1 })
    expect(resolveChildDropTarget('c2', sampleTree())).toEqual({ parentId: 'grid', index: 2 })
    expect(resolveChildDropTarget('grid', sampleTree())).toEqual({ parentId: 'root', index: 2 })
  })

  it('returns null for container drop ids, drag ids, the root, and missing ids', () => {
    const tree = sampleTree()
    expect(resolveChildDropTarget(containerDropId('grid'), tree)).toBeNull()
    expect(resolveChildDropTarget('insert:element:text', tree)).toBeNull()
    expect(resolveChildDropTarget('root', tree)).toBeNull()
    expect(resolveChildDropTarget('nope', tree)).toBeNull()
    expect(resolveChildDropTarget(null, tree)).toBeNull()
  })
})

describe('createPrimitive', () => {
  it('builds minimal valid nodes for every primitive type', () => {
    const types = [
      'container',
      'text',
      'image',
      'button',
      'link',
      'icon',
      'list',
      'divider',
    ] as const
    for (const type of types) {
      const node = createPrimitive(type, `id-${type}`)
      expect(node.type).toBe(type)
      expect(node.id).toBe(`id-${type}`)
      expect(node.style.base).toBeDefined()
    }
  })
})
