import { describe, it, expect } from 'vitest'
import { serializeProject, deserializeProject } from '@project'
import type { CanvasElement } from '../../src/store/elementStore'

const FIXTURE: CanvasElement[] = [
  { id: '1', type: 'rectangle', x: 0, y: 0, width: 12, height: 80, props: { background: '#000' } },
  {
    id: '2',
    type: 'text',
    x: 1,
    y: 100,
    width: 10,
    height: 40,
    props: { text: 'Hi', fontSize: 24 },
  },
]

describe('serializeProject', () => {
  it('produces valid JSON with version: 1 and the elements array', () => {
    const json = serializeProject(FIXTURE)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.elements).toEqual(FIXTURE)
  })
})

describe('deserializeProject', () => {
  it('round-trips identically with serializeProject', () => {
    const json = serializeProject(FIXTURE)
    const result = deserializeProject(json)
    expect(result).not.toBeNull()
    expect(result?.elements).toEqual(FIXTURE)
  })

  it('returns null on invalid JSON', () => {
    expect(deserializeProject('{not json')).toBeNull()
  })

  it('returns null when version is unsupported', () => {
    const json = JSON.stringify({ version: 99, elements: [] })
    expect(deserializeProject(json)).toBeNull()
  })

  it('returns null when elements is not an array', () => {
    const json = JSON.stringify({ version: 1, elements: 'oops' })
    expect(deserializeProject(json)).toBeNull()
  })

  it('returns null when an element has an unknown type', () => {
    const json = JSON.stringify({
      version: 1,
      elements: [{ id: '1', type: 'frobnicator', x: 0, y: 0, width: 1, height: 1, props: {} }],
    })
    expect(deserializeProject(json)).toBeNull()
  })

  it('returns null when an element is missing required numeric fields', () => {
    const json = JSON.stringify({
      version: 1,
      elements: [{ id: '1', type: 'rectangle', x: 0, y: 0, width: 1, props: {} }],
    })
    expect(deserializeProject(json)).toBeNull()
  })

  it('rejects raw JSON arrays without the wrapper object', () => {
    expect(deserializeProject(JSON.stringify(FIXTURE))).toBeNull()
  })
})
