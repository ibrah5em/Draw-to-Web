import { describe, expect, it } from 'vitest'

import {
  buildInsertOp,
  containerDropId,
  createPrimitive,
  parseContainerDropId,
} from '@ui/sidebar/insertDrop'

let counter = 0
const stableId = (): string => `el_${++counter}`

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
